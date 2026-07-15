# AlgoBlink

> Control physical LED devices on-chain by signing Algorand transactions from your wallet.

## Overview

AlgoBlink is a Next.js web app that turns an LED on or off by calling a smart contract on the Algorand blockchain. A command (the target application ID plus a `turnOn` / `turnOff` action) is packed into a URL-safe base64 payload, opened as a signable link, and submitted as an ABI method call from a connected Algorand wallet. The app reads the LED's current state directly from the contract's global state, watches the chain in real time for new control transactions, and broadcasts each state change over a Supabase realtime channel so a listening device or other clients can react instantly.

It's a compact demo of the "blockchain-as-a-control-plane" idea for IoT: the on-chain contract is the source of truth for a device's state, and every toggle is a verifiable, wallet-signed transaction on Algorand TestNet.

## Features

- **Wallet-signed LED control** — connect an Algorand wallet and sign `turnOn()void` / `turnOff()void` app calls to a target application.
- **Multi-wallet support** — Defly, Pera, Exodus, and Lute via `@txnlab/use-wallet-react`.
- **Shareable command links** — commands are encoded as URL-safe base64 and routed to `/sign/<payload>`, so a single link opens a ready-to-sign transaction.
- **Live on-chain state** — reads the LED state from the contract's global state (`led` key) through the Algorand indexer, with a fallback across multiple indexer endpoints.
- **Real-time transaction feed** — an `algokit-subscriber` polls the chain every 5 seconds and lists recent `turnOn` / `turnOff` calls for the app, linked to the Lora explorer.
- **Supabase broadcast channel** — successful toggles are published to a `ledState` realtime channel for downstream listeners (e.g. the physical device).
- **TestNet by default** — targets Algorand TestNet via AlgoNode / Nodely endpoints.

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Blockchain:** `algosdk`, `@algorandfoundation/algokit-utils`, `@algorandfoundation/algokit-subscriber`
- **Wallets:** `@txnlab/use-wallet-react` with Defly, Pera, Exodus, and Lute connectors
- **Realtime / backend:** Supabase (`@supabase/supabase-js`) broadcast channels
- **UI:** Tailwind CSS, shadcn/ui, Radix UI primitives, lucide-react, react-toastify
- **Forms / validation:** react-hook-form, zod

## Getting Started

Requires Node.js and a package manager (the repo includes both `pnpm-lock.yaml` and `package-lock.json`; `pnpm` is recommended).

```bash
# install dependencies
pnpm install        # or: npm install --legacy-peer-deps

# run the dev server
pnpm dev            # or: npm run dev

# build and start for production
pnpm build && pnpm start
```

Then open http://localhost:3000. From the home page, use **Turn LED On** / **Turn LED Off** to open a signable transaction, connect a TestNet wallet, and sign. The app ships pointing at Algorand TestNet, so fund your wallet from a TestNet dispenser before signing.

## Project Structure

```
.
├── app/
│   ├── page.tsx                 # Home — builds encoded turnOn/turnOff links
│   ├── layout.tsx               # Root layout, providers, nav, footer
│   └── sign/[base64json]/       # Decodes a command and signs the app call
├── components/
│   ├── connect-wallet-*.tsx     # Wallet connect button + modal
│   ├── providers.tsx            # use-wallet WalletManager (Defly/Pera/Exodus/Lute)
│   ├── nav.tsx / footer.tsx     # Layout chrome
│   └── ui/                      # shadcn/ui component library
├── lib/
│   ├── subscriber.ts            # algokit-subscriber for LED control app calls
│   ├── app-state.ts             # Reads LED state from contract global state
│   ├── supabase.ts              # Supabase client + ledState broadcast channel
│   └── utils.ts
├── hooks/                       # use-mobile, use-toast
├── public/                      # Static assets
├── tailwind.config.ts
└── next.config.mjs
```

---

Built by [nickthelegend](https://github.com/nickthelegend) · [nickthelegend.tech](https://nickthelegend.tech)
