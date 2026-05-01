# YodaMart — Decentralized Lettuce Marketplace

A full-stack Web3 marketplace for trading lettuce on Ethereum (Sepolia testnet), powered by the YODA ERC-20 token.

---

## Quick start (local)

### Step 1 — Compile contracts and bundle bytecode into the frontend

```bash
npm install
npm run build:contracts
```

This compiles `LettuceMarket` with Hardhat and writes the bytecode to
`frontend/src/contractArtifact.js` so the browser can deploy it.
**No RPC URL or private key is required.**

### Step 2 — Run the frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Step 3 — Use the app in the browser

1. Open `http://localhost:5173`.
2. Click **Connect Wallet** — MetaMask will ask for permission.
3. If you are not on Sepolia, click **Switch to Sepolia**.
4. Click **🚀 Deploy LettuceMarket** — MetaMask will ask you to confirm.  
   *(You need a small amount of Sepolia ETH for gas. Get some from a faucet below.)*
5. After deployment confirms, the address is saved in `localStorage` automatically.
6. The full marketplace opens — Buy, Sell, Auctions, Promotions tabs are live.

> You only need to deploy LettuceMarket **once**. The address is remembered in
> your browser. Next visit it loads automatically.

---

## Marketplace features

Once LettuceMarket is deployed and the address is saved:

| Tab | What you can do |
|-----|----------------|
| **Buy** | Browse listings, enter quantity, click Buy Now. 10+ units get a 20% bulk discount automatically. |
| **Sell** | List your lettuce with price (YODA), quantity, category, and quality. |
| **Auctions** | Create auctions, place bids, withdraw outbid tokens, finalize ended auctions. |
| **Promotions** | Promote listings/auctions for a daily YODA fee to boost visibility. |

All buy/bid/promote actions automatically check your YODA allowance and call
`approve` before the main transaction — MetaMask will show both confirmations
if approval is needed.

---

## Contract details

| Contract | Address | Notes |
|----------|---------|-------|
| YODA Token | `0xbd27d0b7F9fedb5A2A2C3ceF5dC9c70f3CF64Af2` | 2 decimals — already deployed |
| LettuceMarket | *(deployed by you from the browser)* | Saved in localStorage |

### Token decimals
YODA uses **2 decimals** (like cents). Raw value `1000` = **10.00 YODA**.

### Promotion fee
`promotionFeePerDay = 1000` raw = **10.00 YODA per day**.

---

## Changing the marketplace address

If you want to use a different LettuceMarket deployment:

- In the UI: click the **✕ Change** button next to the contract address in the
  marketplace header. The deploy panel reappears so you can paste or redeploy.
- Via env var: set `VITE_LETTUCE_MARKET_ADDRESS` in `frontend/.env` before building.

---
