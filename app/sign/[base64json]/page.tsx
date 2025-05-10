"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useWallet } from "@txnlab/use-wallet-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ConnectWalletButton } from "@/components/connect-wallet-button"
import { Button } from "@/components/ui/button"
import { toast } from "react-toastify"
import algosdk from "algosdk"

interface TransactionData {
  applicationID: string
  command: "turnOn" | "turnOff"
}

export default function SignPage() {
  const params = useParams()
  const { activeAddress, activeAccount, transactionSigner } = useWallet()
  const [decodedData, setDecodedData] = useState<TransactionData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [txId, setTxId] = useState<string | null>(null)
  const [ledStatus, setLedStatus] = useState<string | null>(null)

  useEffect(() => {
    try {
      // Get the base64 string from the URL
      const base64json = params.base64json as string

      // Decode the base64 string
      const decodedString = atob(base64json)

      // Parse the JSON
      const jsonData = JSON.parse(decodedString) as TransactionData

      // Validate the data
      if (!("applicationID" in jsonData) || !("command" in jsonData)) {
        throw new Error("Invalid transaction data: missing required fields")
      }

      if (jsonData.command !== "turnOn" && jsonData.command !== "turnOff") {
        throw new Error("Invalid command: must be 'turnOn' or 'turnOff'")
      }

      setDecodedData(jsonData)
      setIsLoading(false)
    } catch (err) {
      console.error("Error decoding or parsing data:", err)
      setError(err instanceof Error ? err.message : "Failed to decode or parse the data")
      setIsLoading(false)
    }
  }, [params])

  const handleSignTransaction = async () => {
    if (!decodedData) return

    if (!activeAddress || !activeAccount || !transactionSigner) {
      toast.error("Please connect your wallet first")
      return
    }

    setIsProcessing(true)

    try {
      // Create algod client
      const algodServer = "https://testnet-api.algonode.cloud"
      const algodToken = ""
      const algodPort = ""
      const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort)

      // Get suggested parameters
      const suggestedParams = await algodClient.getTransactionParams().do()

      // Create the appropriate method based on the command
      const method = new algosdk.ABIMethod({
        name: decodedData.command,
        desc: "",
        args: [],
        returns: { type: "void", desc: "" },
      })

      // Create application call transaction
      const appId = Number.parseInt(decodedData.applicationID || "0")
      if (isNaN(appId) || appId <= 0) {
        throw new Error("Invalid application ID")
      }

      const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: activeAddress,
        appIndex: appId,
        suggestedParams: suggestedParams,
        appArgs: [method.getSelector()],
        accounts: [],
        foreignApps: [],
        foreignAssets: [],
        boxes: [],
      })

      // Sign the transaction
      const signedTxns = await transactionSigner([appCallTxn] , [0])

      // Send the transaction
      const { txid } = await algodClient.sendRawTransaction(signedTxns).do()

      // Set transaction ID and LED status
      setTxId(txid)
      setLedStatus(decodedData.command === "turnOn" ? "LED is on!" : "LED is off!")

      toast.success(`Transaction sent successfully! ${decodedData.command === "turnOn" ? "LED is on!" : "LED is off!"}`)
    } catch (err) {
      console.error("Error signing or sending transaction:", err)
      toast.error(err instanceof Error ? err.message : "Failed to sign or send transaction")
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <div className="text-xl">Loading...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <p className="text-center text-muted-foreground">The provided data could not be decoded or parsed as JSON.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">LED Control Transaction</CardTitle>
          <CardDescription>Review the transaction details below before signing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {decodedData && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start border-b pb-4">
                  <div className="font-medium">Application ID</div>
                  <div className="md:col-span-2 break-all">{decodedData.applicationID || "Not specified"}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start border-b pb-4">
                  <div className="font-medium">Command</div>
                  <div className="md:col-span-2 break-all">
                    {decodedData.command === "turnOn" ? "Turn LED On" : "Turn LED Off"}
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {txId ? (
        <Alert className="mb-6">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Transaction Successful</AlertTitle>
          <AlertDescription>
            <div className="mt-2">
              <p>
                <strong>Transaction ID:</strong> {txId}
              </p>
              <p className="mt-2 text-lg font-bold">{ledStatus}</p>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>Connect your wallet and sign this transaction to control the LED</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row justify-center gap-4">
        {!activeAddress ? (
          <ConnectWalletButton />
        ) : (
          <Button onClick={handleSignTransaction} disabled={isProcessing} className="flex items-center gap-2">
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
            {isProcessing ? "Processing..." : "Sign Transaction"}
          </Button>
        )}
      </div>
    </div>
  )
}
