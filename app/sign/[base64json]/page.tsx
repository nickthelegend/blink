"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { useWallet } from "@txnlab/use-wallet-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ConnectWalletButton } from "@/components/connect-wallet-button"
import { Button } from "@/components/ui/button"
import { toast } from "react-toastify"
import algosdk from "algosdk"
import { createLedControlSubscriber, getMethodSelector } from "@/lib/subscriber"
import { fetchLedState, fetchLedStateWithSDK } from "@/lib/app-state"
import { broadcastLedState } from "@/lib/supabase"

// Define the TransactionData interface
interface TransactionData {
  applicationID: string
  command: string
}

// Update the AppCallTransaction interface to include intraRoundOffset
interface AppCallTransaction {
  id: string
  sender: string
  round: number | string
  timestamp: string
  methodName?: string
  status?: string
  intraRoundOffset?: number
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
  const [recentTransactions, setRecentTransactions] = useState<AppCallTransaction[]>([])
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [methodSelectors, setMethodSelectors] = useState<{ turnOn: string; turnOff: string }>({
    turnOn: "",
    turnOff: "",
  })
  const [isFetchingState, setIsFetchingState] = useState(false)

  // Track the current transaction ID to avoid duplicate broadcasts
  const currentTxIdRef = useRef<string | null>(null)

  // Use refs to prevent multiple subscriptions
  const subscriberRef = useRef<{ unsubscribe: () => void } | null>(null)
  const hasSubscribedRef = useRef(false)

  // Track processed transaction IDs to prevent duplicates
  const processedTxIds = useRef<Set<string>>(new Set())

  // Calculate method selectors on component mount
  useEffect(() => {
    const turnOnSelector = getMethodSelector("turnOn")
    const turnOffSelector = getMethodSelector("turnOff")

    setMethodSelectors({
      turnOn: turnOnSelector,
      turnOff: turnOffSelector,
    })

    console.log("Method selectors calculated:", {
      turnOn: turnOnSelector,
      turnOff: turnOffSelector,
    })
  }, [])

  useEffect(() => {
    try {
      // Get the base64 string from the URL
      let base64json = params.base64json as string

      // Fix URL encoding issues with base64
      // Replace URL-safe characters back to base64 standard characters
      base64json = base64json.replace(/-/g, "+").replace(/_/g, "/")

      // Add padding if needed
      while (base64json.length % 4) {
        base64json += "="
      }

      console.log("Processing base64 string:", base64json)

      // Decode the base64 string
      let decodedString
      try {
        decodedString = atob(base64json)
      } catch (e) {
        console.error("Base64 decoding error:", e)
        // Try an alternative approach for browsers that might handle base64 differently
        decodedString = Buffer.from(base64json, "base64").toString()
      }

      console.log("Decoded string:", decodedString)

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

      // Fetch the current LED state
      if (jsonData.applicationID) {
        fetchCurrentLedState(Number.parseInt(jsonData.applicationID))
      }
    } catch (err) {
      console.error("Error decoding or parsing data:", err)
      setError(err instanceof Error ? err.message : "Failed to decode or parse the data")
      setIsLoading(false)
    }
  }, [params])

  // Function to fetch the current LED state
  const fetchCurrentLedState = async (appId: number) => {
    if (isNaN(appId) || appId <= 0) return

    setIsFetchingState(true)
    try {
      console.log(`Fetching LED state for app ID: ${appId}`)

      // Try the direct fetch method first
      try {
        const state = await fetchLedState(appId)
        setLedStatus(`LED is ${state.toLowerCase()}!`)
        console.log(`Current LED state: ${state}`)
        return
      } catch (directError) {
        console.error("Direct fetch method failed:", directError)
        // Fall back to SDK method
      }

      // Try the SDK method as fallback
      const state = await fetchLedStateWithSDK(appId)
      setLedStatus(`LED is ${state.toLowerCase()}!`)
      console.log(`Current LED state: ${state}`)
    } catch (error) {
      console.error("Error fetching LED state:", error)
      setLedStatus("Could not fetch LED state")
    } finally {
      setIsFetchingState(false)
    }
  }

  // Function to add a transaction to the recent transactions list
  const addTransaction = (transaction: AppCallTransaction) => {
    // Check if this transaction ID has already been processed
    if (processedTxIds.current.has(transaction.id)) {
      console.log(`Transaction ${transaction.id} already processed, skipping`)
      return
    }

    // Add to processed set
    processedTxIds.current.add(transaction.id)

    // Add to recent transactions
    setRecentTransactions((prev) => {
      // Check if transaction already exists in the list
      const exists = prev.some((tx) => tx.id === transaction.id)
      if (exists) {
        console.log(`Transaction ${transaction.id} already in list, skipping`)
        return prev
      }

      // Add new transaction to the list
      const newTransactions = [transaction, ...prev]

      // Sort transactions with most recent at the top
      // For transactions with numeric rounds, sort by round (descending)
      // For "Pending" transactions, place them at the top
      return newTransactions
        .sort((a, b) => {
          // If either transaction is "Pending", it should be at the top
          if (a.round === "Pending") return -1
          if (b.round === "Pending") return 1

          // If both have numeric rounds, sort by round (descending)
          const roundA = typeof a.round === "number" ? a.round : Number.parseInt(a.round as string)
          const roundB = typeof b.round === "number" ? b.round : Number.parseInt(b.round as string)

          // Sort by round in descending order (higher round = more recent)
          return roundB - roundA
        })
        .slice(0, 5) // Keep only the 5 most recent transactions
    })
  }

  // Subscribe to app calls for the specified application ID
  useEffect(() => {
    if (!decodedData?.applicationID || hasSubscribedRef.current) return

    const appId = Number.parseInt(decodedData.applicationID)
    if (isNaN(appId) || appId <= 0) return

    const setupSubscription = async () => {
      try {
        // Prevent multiple subscriptions
        if (hasSubscribedRef.current) return
        hasSubscribedRef.current = true

        console.log(`Setting up subscription for app ID: ${appId}`)

        // Create a subscriber for LED control app calls
        const subscriber = createLedControlSubscriber(appId, async (transaction, methodName) => {
          console.log(`Received transaction:`, transaction)

          // Update LED status based on the method
          if (methodName === "turnOn") {
            setLedStatus("LED is on!")
            // No broadcast here - only broadcast for the current transaction
          } else if (methodName === "turnOff") {
            setLedStatus("LED is off!")
            // No broadcast here - only broadcast for the current transaction
          }

          // Format the transaction for display
          const formattedTransaction: AppCallTransaction = {
            id: transaction.id,
            sender: transaction.sender,
            round: transaction.confirmedRound || "Pending",
            timestamp: new Date().toLocaleTimeString(),
            methodName: methodName,
            // Set status based on method
            status: methodName === "turnOn" ? "LED is on!" : methodName === "turnOff" ? "LED is off!" : "Unknown",
            intraRoundOffset: transaction.intraRoundOffset || 0,
          }

          // Add to recent transactions (with duplicate prevention)
          addTransaction(formattedTransaction)

          // Refresh the LED state after a transaction is detected
          fetchCurrentLedState(appId)
        })

        subscriberRef.current = subscriber
        setIsSubscribed(true)
        // Only show one toast for subscription success
        toast.success(`Subscribed to app calls for application ID: ${appId}`, {
          autoClose: 3000,
          hideProgressBar: true,
        })
      } catch (err) {
        console.error("Error setting up subscription:", err)
        toast.error("Failed to subscribe to app calls", {
          autoClose: 3000,
          hideProgressBar: true,
        })
        hasSubscribedRef.current = false
      }
    }

    setupSubscription()

    // Cleanup function to unsubscribe when component unmounts
    return () => {
      if (subscriberRef.current) {
        subscriberRef.current.unsubscribe()
        subscriberRef.current = null
      }
      hasSubscribedRef.current = false
      setIsSubscribed(false)
    }
  }, [decodedData?.applicationID])

  const handleSignTransaction = async () => {
    if (!decodedData) return

    if (!activeAddress || !activeAccount || !transactionSigner) {
      toast.error("Please connect your wallet first", {
        autoClose: 3000,
        hideProgressBar: true,
      })
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

      // Log the method selector being used
      console.log(
        `Using method selector for ${decodedData.command}:`,
        Buffer.from(method.getSelector()).toString("hex"),
      )

      // Sign the transaction
      const signedTxns = await transactionSigner([appCallTxn], [0])

      // Send the transaction
      const { txid } = await algodClient.sendRawTransaction(signedTxns).do()

      // Store the current transaction ID to avoid duplicate broadcasts
      currentTxIdRef.current = txid

      // Immediately broadcast the LED state change after successful transaction submission
      // This is the ONLY place where we broadcast
      console.log("Transaction sent successfully, broadcasting state change...")
      const eventName = decodedData.command === "turnOn" ? "ledOn" : "ledOff"
      await broadcastLedState(eventName, txid, activeAddress)

      // Set transaction ID and LED status based on command
      setTxId(txid)
      setLedStatus(decodedData.command === "turnOn" ? "LED is on!" : "LED is off!")

      // Add to recent transactions
      const newTransaction: AppCallTransaction = {
        id: txid,
        sender: activeAddress,
        round: "Pending",
        timestamp: new Date().toLocaleTimeString(),
        methodName: decodedData.command,
        status: decodedData.command === "turnOn" ? "LED is on!" : "LED is off!",
        intraRoundOffset: 0, // Default value for new transactions
      }

      // Add to recent transactions (with duplicate prevention)
      addTransaction(newTransaction)

      // Only show one toast for transaction success
      toast.success(`Transaction sent successfully!`, {
        autoClose: 3000,
        hideProgressBar: true,
      })

      // Wait a moment and then fetch the updated LED state
      setTimeout(() => {
        fetchCurrentLedState(appId)
      }, 5000) // Wait 5 seconds for the transaction to be confirmed
    } catch (err) {
      console.error("Error signing or sending transaction:", err)
      toast.error("Failed to sign or send transaction", {
        autoClose: 3000,
        hideProgressBar: true,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Function to refresh the LED state
  const refreshLedState = () => {
    if (decodedData?.applicationID) {
      fetchCurrentLedState(Number.parseInt(decodedData.applicationID))
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start border-b pb-4">
                  <div className="font-medium">Method Selector</div>
                  <div className="md:col-span-2 break-all font-mono">
                    {decodedData.command === "turnOn" ? methodSelectors.turnOn : methodSelectors.turnOff}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start border-b pb-4">
                  <div className="font-medium">Subscription Status</div>
                  <div className="md:col-span-2 break-all">
                    {isSubscribed ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Subscribed to app calls for this application
                      </span>
                    ) : (
                      <span className="text-yellow-600 dark:text-yellow-400">Not subscribed to app calls</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start border-b pb-4">
                  <div className="font-medium">Current LED Status</div>
                  <div className="md:col-span-2 break-all flex items-center">
                    {isFetchingState ? (
                      <div className="flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Fetching LED state...</span>
                      </div>
                    ) : ledStatus ? (
                      <div className="flex items-center">
                        <span className={`font-bold ${ledStatus.includes("on") ? "text-green-600" : "text-red-600"}`}>
                          {ledStatus}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={refreshLedState}
                          className="ml-2"
                          disabled={isFetchingState}
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span className="sr-only">Refresh LED state</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span className="text-gray-500">Unknown</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={refreshLedState}
                          className="ml-2"
                          disabled={isFetchingState}
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span className="sr-only">Refresh LED state</span>
                        </Button>
                      </div>
                    )}
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
              <p className={`mt-2 text-lg font-bold ${ledStatus?.includes("on") ? "text-green-600" : "text-red-600"}`}>
                {ledStatus}
              </p>
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

      {recentTransactions.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent Transactions</CardTitle>
              <CardDescription>Recent LED control transactions detected by the subscriber</CardDescription>
            </div>
            <div className="flex items-center">
              <span className="text-xs text-muted-foreground mr-2">
                {isSubscribed ? "Listening for transactions" : "Not listening"}
              </span>
              {isSubscribed && <RefreshCw className="h-4 w-4 animate-spin text-green-500" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Time</th>
                    <th className="text-left py-2 px-2">Transaction ID</th>
                    <th className="text-left py-2 px-2">Sender</th>
                    <th className="text-left py-2 px-2">Method</th>
                    <th className="text-left py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 px-2">{tx.timestamp}</td>
                      <td className="py-2 px-2 font-mono">
                        <a
                          href={`https://lora.algokit.io/testnet/transaction/${tx.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {tx.id.slice(0, 8)}...
                        </a>
                      </td>
                      <td className="py-2 px-2 font-mono">
                        <a
                          href={`https://lora.algokit.io/testnet/account/${tx.sender}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {tx.sender.slice(0, 4)}...{tx.sender.slice(-4)}
                        </a>
                      </td>
                      <td className="py-2 px-2">{tx.methodName}</td>
                      <td className="py-2 px-2">
                        <span className={tx.status?.includes("on") ? "text-green-600" : "text-red-600"}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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
