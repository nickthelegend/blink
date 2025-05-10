import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client with service_role key
const SUPABASE_URL = "https://uorbdplqtxmcdhbnkbmf.supabase.co"
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvcmJkcGxxdHhtY2RoYm5rYm1mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjYyMTQxMiwiZXhwIjoyMDU4MTk3NDEyfQ.7jcCez98a57cjrPAv7l_wc-rWin55Y_H80mw-G7swSw"

export const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Create a channel for LED state broadcasts
export const ledStateChannel = supabase.channel("ledState")

// Initialize the channel
ledStateChannel.subscribe((status, error) => {
  if (error) {
    console.error("[Subscribe Error]", error)
    return
  }

  if (status === "SUBSCRIBED") {
    console.log('✅ Subscribed to channel "ledState"')
  }
})

/**
 * Broadcast LED state change
 * @param event The event name ('ledOn' or 'ledOff')
 * @param txId The transaction ID that triggered the state change
 * @param sender The address that sent the transaction
 */
export async function broadcastLedState(event: "ledOn" | "ledOff", txId: string, sender: string) {
  try {
    console.log(`Broadcasting LED state change: ${event} for transaction ${txId}`)

    const payload = {
      txId,
      sender,
      timestamp: new Date().toISOString(),
      state: event === "ledOn" ? "On" : "Off",
    }

    console.log("Broadcast payload:", payload)

    const { error } = await ledStateChannel.send({
      type: "broadcast",
      event: event,
      payload,
    })

    if (error) {
      console.error("[Broadcast Error]", error)
      return false
    }

    console.log(`➡️ Broadcast sent successfully: ${event} for transaction ${txId}`)
    return true
  } catch (error) {
    console.error("[Broadcast Exception]", error)
    return false
  }
}
