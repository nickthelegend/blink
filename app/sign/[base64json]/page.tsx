"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ConnectWalletButton } from "@/components/connect-wallet-button"

export default function SignPage() {
  const params = useParams()
  const [decodedData, setDecodedData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      // Get the base64 string from the URL
      const base64json = params.base64json as string

      // Decode the base64 string
      const decodedString = atob(base64json)

      // Parse the JSON
      const jsonData = JSON.parse(decodedString)

      setDecodedData(jsonData)
      setIsLoading(false)
    } catch (err) {
      console.error("Error decoding or parsing data:", err)
      setError(err instanceof Error ? err.message : "Failed to decode or parse the data")
      setIsLoading(false)
    }
  }, [params])

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="animate-pulse text-xl">Loading...</div>
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
          <CardTitle className="text-2xl">Transaction Details</CardTitle>
          <CardDescription>Review the transaction details below before signing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {decodedData &&
              Object.entries(decodedData).map(([key, value]) => (
                <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start border-b pb-4">
                  <div className="font-medium">{key}</div>
                  <div className="md:col-span-2 break-all">
                    {typeof value === "object" ? (
                      <pre className="bg-muted p-2 rounded-md overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>
                    ) : (
                      String(value)
                    )}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Alert className="mb-6">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Action Required</AlertTitle>
        <AlertDescription>Connect your wallet to sign this transaction</AlertDescription>
      </Alert>

      <div className="flex justify-center">
        <ConnectWalletButton />
      </div>
    </div>
  )
}
