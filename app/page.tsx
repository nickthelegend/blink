import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  // Example base64 encoded JSON for testing
  const exampleJson = btoa(
    JSON.stringify({
      type: "transaction",
      amount: 1000,
      recipient: "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789",
      note: "Payment for services",
    }),
  )

  return (
    <div className="container mx-auto py-12">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-4xl font-bold mb-6">Welcome to AlgoBlink</h1>
        <p className="text-xl mb-8 max-w-2xl">Connect your Algorand wallet and sign transactions with ease</p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild>
            <Link href={`/sign/${exampleJson}`}>Try Demo Transaction</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
