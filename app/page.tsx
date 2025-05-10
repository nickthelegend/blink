import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  // Function to safely encode JSON for URL
  const safeBase64Encode = (obj: any): string => {
    const jsonString = JSON.stringify(obj)
    // First encode as base64
    const base64 = btoa(jsonString)
    // Then make it URL safe by replacing characters that might cause issues
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  }

  // Example base64 encoded JSON for LED control
  const turnOnExample = safeBase64Encode({
    applicationID: "739285260",
    command: "turnOn",
  })

  const turnOffExample = safeBase64Encode({
    applicationID: "739285260",
    command: "turnOff",
  })

  return (
    <div className="container mx-auto py-12">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-4xl font-bold mb-6">Welcome to AlgoBlink</h1>
        <p className="text-xl mb-8 max-w-2xl">Control your LED devices on the Algorand blockchain</p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild variant="default">
            <Link href={`/sign/${turnOnExample}`}>Turn LED On</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/sign/${turnOffExample}`}>Turn LED Off</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
