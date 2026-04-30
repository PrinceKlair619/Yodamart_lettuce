# YodaMart — Decentralized Lettuce Marketplace

A full-stack Web3 marketplace for trading lettuce on Ethereum (Sepolia testnet), powered by the YODA ERC-20 token.

**No Alchemy. No Infura. No private keys. No .env setup required.**
Everything runs through MetaMask in the browser.

---

## Architecture

| Layer | Tool | Notes |
|-------|------|-------|
| Contracts | Hardhat (compile only) | Bytecode is bundled into the frontend |
| Frontend | React + Vite + ethers v6 | Static site — works on GitHub Pages |
| Deployment | MetaMask (browser) | ContractFactory + window.ethereum |
| Token | YODA ERC-20 (Sepolia) | Already deployed — do not redeploy |
| Market | LettuceMarket | Deployed once from the browser UI |

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

## GitHub Pages deployment

```bash
# 1. Compile contracts (from project root)
npm run build:contracts

# 2. Build and publish the frontend
cd frontend
npm install
npm run deploy   # runs: vite build → gh-pages -d dist
```

> **Note:** GitHub Pages serves your site at `https://username.github.io/repo-name/`.
> If your repo is not at the root (`username.github.io`), add `base` to
> `frontend/vite.config.js`:
> ```js
> export default defineConfig({
>   base: '/your-repo-name/',
>   plugins: [react()],
> })
> ```

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

## Sepolia ETH faucets

You need Sepolia ETH to deploy the contract and pay gas for transactions:

- https://sepoliafaucet.com
- https://faucet.quicknode.com/ethereum/sepolia
- https://faucets.chain.link

---

## Project structure

```
yodamart-lettuce/
├── contracts/
│   └── Lettuce_contract.sol       ← LettuceMarket Solidity contract
├── scripts/
│   └── copyArtifacts.js           ← Copies ABI+bytecode to frontend
├── hardhat.config.cjs             ← Compile-only config, no RPC/keys needed
├── package.json                   ← Root: npm run build:contracts
└── frontend/
    ├── src/
    │   ├── App.jsx                ← Full marketplace + deploy panel
    │   ├── App.css                ← Lettuce-themed design system
    │   ├── contractConfig.js      ← ABIs + YODA address
    │   └── contractArtifact.js    ← Auto-generated ABI+bytecode (after build:contracts)
    └── package.json               ← npm run dev / build / deploy
```

---

## Changing the marketplace address

If you want to use a different LettuceMarket deployment:

- In the UI: click the **✕ Change** button next to the contract address in the
  marketplace header. The deploy panel reappears so you can paste or redeploy.
- Via env var: set `VITE_LETTUCE_MARKET_ADDRESS` in `frontend/.env` before building.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Bytecode not available" | Run `npm run build:contracts` from the project root |
| MetaMask shows wrong network | Click *Switch to Sepolia* in the app |
| "Transaction rejected" | You clicked Reject in MetaMask — no funds were spent |
| Deploy fails with out-of-gas | Fund your MetaMask with more Sepolia ETH |
| App shows deploy panel every time | Check `localStorage` — clear browser data may have removed the saved address |
| No listings showing after deploy | The contract is new — list some lettuce in the Sell tab |
