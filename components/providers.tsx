"use client"

import type React from "react"
import { NetworkId, WalletId, WalletManager, WalletProvider } from "@txnlab/use-wallet-react"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"

const walletManager = new WalletManager({
  wallets: [
    WalletId.DEFLY,
    WalletId.PERA,
    WalletId.EXODUS,
    {
      id: WalletId.LUTE,
      options: { siteName: "AlgoBlink" },
    },
  ],
  defaultNetwork: NetworkId.TESTNET,
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider manager={walletManager}>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={true}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss={false}
        draggable
        pauseOnHover={false}
        theme="light"
        limit={1}
      />
    </WalletProvider>
  )
}
