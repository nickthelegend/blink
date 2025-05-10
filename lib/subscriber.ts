import { AlgorandSubscriber } from "@algorandfoundation/algokit-subscriber"
import algosdk, { TransactionType } from "algosdk"

// Create an Algod client for the Algorand TestNet
const algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "")

// Create an Indexer client for the Algorand TestNet
const indexerClient = new algosdk.Indexer("", "https://testnet-idx.algonode.cloud", "")

// In-memory watermark storage (for demo purposes)
const watermarks = new Map<number, bigint>()

// Method selectors for turnOn and turnOff
// These are the first 4 bytes of the hash of the method signature
const METHOD_SELECTORS = {
  // These are examples - the actual values may be different
  TURN_ON: ["f78f4f2d", "7475726e4f6e"], // "turnOn" in hex is 7475726e4f6e
  TURN_OFF: ["31db4745", "7475726e4f6666"], // "turnOff" in hex is 7475726e4f6666
}

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

  // Create the subscriber with a filter for app calls to the specified app ID
  const subscriber = new AlgorandSubscriber(
    {
      filters: [
        {
          name: "app-call",
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

  // Set up the subscription to the app call filter
  subscriber.on("app-call", (transaction) => {
    console.log(`Detected app call transaction:`, transaction)

    try {
      // Extract the application transaction details
      const appTxn = transaction.applicationTransaction

      if (!appTxn || !appTxn.applicationArgs || appTxn.applicationArgs.length === 0) {
        console.log("Transaction doesn't have application args")
        return
      }

      // Get the first application argument (method selector)
      const methodSelector = Buffer.from(appTxn.applicationArgs[0]).toString("hex")
      console.log(`Method selector: ${methodSelector}`)

      // Determine if it's turnOn or turnOff
      let methodName = "unknown"

      if (METHOD_SELECTORS.TURN_ON.some((selector) => methodSelector.includes(selector))) {
        methodName = "turnOn"
      } else if (METHOD_SELECTORS.TURN_OFF.some((selector) => methodSelector.includes(selector))) {
        methodName = "turnOff"
      }

      console.log(`Detected method: ${methodName}`)

      // Call the callback with the transaction and method name
      onTransaction(
        {
          id: transaction.id,
          sender: transaction.sender,
          confirmedRound: transaction.confirmedRound,
          applicationTransaction: appTxn,
        },
        methodName,
      )
    } catch (error) {
      console.error("Error processing LED control transaction:", error)
    }
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
      subscriber.stop("SAD")
      console.log(`Stopped subscriber for app ID: ${appId}`)
    },
  }
}
