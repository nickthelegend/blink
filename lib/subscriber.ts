import { AlgorandSubscriber } from "@algorandfoundation/algokit-subscriber"
import algosdk, { TransactionType } from "algosdk"

// Create an Algod client for the Algorand TestNet
const algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "")

// Create an Indexer client for the Algorand TestNet
const indexerClient = new algosdk.Indexer("", "https://testnet-idx.algonode.cloud", "")

// In-memory watermark storage (for demo purposes)
const watermarks = new Map<number, bigint>()

// Track processed transaction IDs to prevent duplicates
const processedTransactions = new Set<string>()

/**
 * Create a subscriber for LED control app calls
 * @param appId The LED control application ID
 * @param onTransaction Callback function when a transaction is detected
 * @returns The subscriber instance and a function to unsubscribe
 */
export const createLedControlSubscriber = (
  appId: number,
  onTransaction: (transaction: any, methodName: string) => void,
) => {
  console.log(`Creating subscriber for app ID: ${appId}`)

  // Create the subscriber with filters for specific method signatures
  const subscriber = new AlgorandSubscriber(
    {
      filters: [
        {
          name: "turn-on",
          filter: {
            type: TransactionType.appl,
            appId: BigInt(appId),
            methodSignature: "turnOn()void",
          },
        },
        {
          name: "turn-off",
          filter: {
            type: TransactionType.appl,
            appId: BigInt(appId),
            methodSignature: "turnOff()void",
          },
        },
        // Fallback filter for any app calls to this app ID
        {
          name: "app-call-fallback",
          filter: {
            type: TransactionType.appl,
            appId: BigInt(appId),
          },
        },
      ],
      frequencyInSeconds: 5, // Poll every 5 seconds
      maxRoundsToSync: 10, // Don't go too far back in history
      syncBehaviour: "catchup-with-indexer",
      watermarkPersistence: {
        // Simple in-memory watermark persistence
        get: async () => watermarks.get(appId) || 0n,
        set: async (watermark) => {
          watermarks.set(appId, watermark)
        },
      },
    },
    algodClient,
    indexerClient,
  )

  // Helper function to process transaction and prevent duplicates
  const processTransaction = (transaction: any, methodName: string) => {
    // Check if we've already processed this transaction
    if (processedTransactions.has(transaction.id)) {
      console.log(`Transaction ${transaction.id} already processed, skipping`)
      return
    }

    // Add to processed set
    processedTransactions.add(transaction.id)

    // Call the callback
    onTransaction(
      {
        id: transaction.id,
        sender: transaction.sender,
        confirmedRound: transaction.confirmedRound,
        applicationTransaction: transaction.applicationTransaction,
      },
      methodName,
    )
  }

  // Set up the subscription to the turnOn method
  subscriber.on("turn-on", (transaction) => {
    console.log(`Detected turnOn transaction:`, transaction)
    processTransaction(transaction, "turnOn")
  })

  // Set up the subscription to the turnOff method
  subscriber.on("turn-off", (transaction) => {
    console.log(`Detected turnOff transaction:`, transaction)
    processTransaction(transaction, "turnOff")
  })

  // Set up the subscription to any other app calls (fallback)
  subscriber.on("app-call-fallback", (transaction) => {
    // Skip if we've already processed this transaction via a specific method filter
    if (processedTransactions.has(transaction.id)) {
      return
    }

    console.log(`Detected other app call transaction:`, transaction)

    // Try to determine the method from the application args
    let methodName = "unknown"
    try {
      if (
        transaction.applicationTransaction &&
        transaction.applicationTransaction.applicationArgs &&
        transaction.applicationTransaction.applicationArgs.length > 0
      ) {
        const methodArg = Buffer.from(transaction.applicationTransaction.applicationArgs[0]).toString("hex")

        // Log the method selector for debugging
        console.log(`Method selector from args: ${methodArg}`)

        // Try to match with known method selectors
        if (methodArg === getMethodSelector("turnOn")) {
          methodName = "turnOn"
        } else if (methodArg === getMethodSelector("turnOff")) {
          methodName = "turnOff"
        }
      }
    } catch (error) {
      console.error("Error extracting method name:", error)
    }

    processTransaction(transaction, methodName)
  })

  // Set up poll handling to log information about each poll
  subscriber.onPoll((poll) => {
    console.log(
      `Polled rounds ${poll.syncedRoundRange[0]}-${poll.syncedRoundRange[1]}, ` +
        `found ${poll.subscribedTransactions.length} matching transactions`,
    )

    // Log each transaction found in this poll
    if (poll.subscribedTransactions.length > 0) {
      console.log("Transactions in this poll:", poll.subscribedTransactions)
    }
  })

  // Set up error handling
  subscriber.onError((error) => {
    console.error("Subscriber error:", error)
  })

  // Start the subscriber
  subscriber.start()

  console.log(`Started subscriber for app ID: ${appId}`)

  // Return the subscriber and a function to stop it
  return {
    unsubscribe: () => {
      subscriber.stop("Stopped")
      console.log(`Stopped subscriber for app ID: ${appId}`)
    },
  }
}

/**
 * Get the method selector for a given method name and signature
 * This can be used to debug and find the correct method selectors
 */
export const getMethodSelector = (methodName: string, args: string[] = []): string => {
  const method = new algosdk.ABIMethod({
    name: methodName,
    args: args.map((arg) => ({ type: arg })),
    returns: { type: "void" },
  })

  const selector = method.getSelector()
  return Buffer.from(selector).toString("hex")
}

// Log the method selectors for turnOn and turnOff for debugging
console.log("turnOn method selector:", getMethodSelector("turnOn"))
console.log("turnOff method selector:", getMethodSelector("turnOff"))
