import algosdk from "algosdk"

/**
 * Fetches the current state of the LED from the application's global state
 * @param appId The application ID to query
 * @returns A promise that resolves to the LED state ("On" or "Off")
 */
export async function fetchLedState(appId: number): Promise<string> {
  try {
    // Use the same indexer URL as in the curl example
    const indexerUrl = "https://testnet-idx.4160.nodely.dev"

    // Directly fetch the application info using fetch API instead of the SDK
    // This matches the curl command more closely
    const response = await fetch(`${indexerUrl}/v2/applications/${appId}`)

    if (!response.ok) {
      throw new Error(`Indexer API error: ${response.status} ${response.statusText}`)
    }

    const appInfo = await response.json()
    console.log("Application info:", JSON.stringify(appInfo, null, 2))

    // Check if the application exists and has global state
    if (!appInfo.application || !appInfo.application.params || !appInfo.application.params["global-state"]) {
      throw new Error("Application not found or has no global state")
    }

    // Find the LED state in the global state
    const globalState = appInfo.application.params["global-state"]
    const ledStateEntry = globalState.find((entry: any) => {
      // "bGVk" is base64 for "led"
      return entry.key === "bGVk"
    })

    if (!ledStateEntry) {
      throw new Error("LED state not found in application global state")
    }

    // Get the base64 encoded value
    const base64Value = ledStateEntry.value.bytes
    console.log("Raw base64 LED state:", base64Value)

    // Decode the base64 value
    const decodedBytes = Buffer.from(base64Value, "base64")
    console.log("Decoded bytes:", Array.from(decodedBytes).join(", "))

    // Extract the actual state string
    // Format appears to be: [null byte][length byte][actual state]
    // For example: "AAJPbg==" decodes to [0, 2, 79, 110] which is [null, 2, "O", "n"]
    let stateString = ""

    // Skip the first two bytes (null byte and length byte)
    for (let i = 2; i < decodedBytes.length; i++) {
      stateString += String.fromCharCode(decodedBytes[i])
    }

    console.log("Extracted LED state:", stateString)
    return stateString
  } catch (error) {
    console.error("Error in fetchLedState:", error)
    throw error
  }
}

/**
 * Alternative method to fetch LED state using the algosdk
 * This is a fallback in case the direct fetch method doesn't work
 */
export async function fetchLedStateWithSDK(appId: number): Promise<string> {
  try {
    // Try multiple indexer endpoints
    const indexerUrls = [
      "https://testnet-idx.4160.nodely.dev",
      "https://testnet-idx.algonode.cloud",
      "https://algoindexer.testnet.algoexplorerapi.io",
    ]

    let lastError = null

    // Try each indexer URL until one works
    for (const indexerUrl of indexerUrls) {
      try {
        console.log(`Trying indexer URL: ${indexerUrl}`)
        const indexerClient = new algosdk.Indexer("", indexerUrl, "")

        // Fetch the application information
        const appInfo = await indexerClient.lookupApplications(appId).do()
        console.log(`Success with ${indexerUrl}:`, JSON.stringify(appInfo, null, 2))

        // Check if the application exists and has global state
        if (!appInfo.application || !appInfo.application.params["global-state"]) {
          throw new Error("Application not found or has no global state")
        }

        // Find the LED state in the global state
        const globalState = appInfo.application.params["global-state"]
        const ledStateEntry = globalState.find((entry: any) => {
          // "bGVk" is base64 for "led"
          return entry.key === "bGVk"
        })

        if (!ledStateEntry) {
          throw new Error("LED state not found in application global state")
        }

        // Get the base64 encoded value
        const base64Value = ledStateEntry.value.bytes
        console.log("Raw base64 LED state:", base64Value)

        // Decode the base64 value
        const decodedBytes = Buffer.from(base64Value, "base64")
        console.log("Decoded bytes:", Array.from(decodedBytes).join(", "))

        // Extract the actual state string
        let stateString = ""

        // Skip the first two bytes (null byte and length byte)
        for (let i = 2; i < decodedBytes.length; i++) {
          stateString += String.fromCharCode(decodedBytes[i])
        }

        console.log("Extracted LED state:", stateString)
        return stateString
      } catch (err) {
        console.error(`Error with indexer ${indexerUrl}:`, err)
        lastError = err
        // Continue to the next indexer URL
      }
    }

    // If we get here, all indexer URLs failed
    throw lastError || new Error("All indexer endpoints failed")
  } catch (error) {
    console.error("Error in fetchLedStateWithSDK:", error)
    throw error
  }
}
