import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import "./App.css";
import {
  YODA_TOKEN_ADDRESS,
  LETTUCE_MARKET_ABI,
  ERC20_ABI,
} from "./contractConfig";
// DEPLOY_ABI is the full JSON ABI from the Hardhat artifact.
// It includes the constructor entry, which is required by ethers ContractFactory.
// (The human-readable LETTUCE_MARKET_ABI from contractConfig lacks a constructor.)
import {
  LETTUCE_MARKET_ABI as DEPLOY_ABI,
  LETTUCE_MARKET_BYTECODE,
} from "./contractArtifact";

// ──────────────────────────────────────────────────────────────
//  Constants
// ──────────────────────────────────────────────────────────────
const SEPOLIA_CHAIN_ID   = "0xaa36a7"; // 11155111
const LS_KEY             = "lettuce_market_address";

const CATEGORIES    = ["Romaine", "Iceberg", "Butterhead", "Arugula", "Spinach", "Mixed"];
const QUALITIES     = ["Premium", "Standard", "Economy"];

// ──────────────────────────────────────────────────────────────
//  YODA decimal helpers  (2 decimals)
// ──────────────────────────────────────────────────────────────
const parseYoda  = (val) => ethers.parseUnits(String(val), 2);
const formatYoda = (val) => ethers.formatUnits(val, 2);

// ──────────────────────────────────────────────────────────────
//  Utility helpers
// ──────────────────────────────────────────────────────────────
function qualityClass(q) {
  return q ? "quality-" + q.toLowerCase() : "";
}

function statusVariant(s, wallet) {
  const l = s.toLowerCase();
  if (l.includes("fail") || l.includes("error") || l.includes("reject"))
    return "status-error";
  if (wallet || l.includes("loaded") || l.includes("connected") || l.includes("success"))
    return "status-success";
  return "status-info";
}

function parseError(err) {
  if (!err) return "Unknown error.";
  if (err.code === 4001 || err.code === "ACTION_REJECTED" || err.message?.includes("user rejected"))
    return "Transaction rejected by user.";
  if (err.reason) return err.reason;
  if (err.message?.includes("allowance")) return "YODA allowance too low. Approve more first.";
  if (err.message?.includes("insufficient")) return "Insufficient YODA balance.";
  if (err.message?.includes("Not your listing")) return "You are not the seller of this listing.";
  if (err.message?.includes("Not your auction")) return "You are not the seller of this auction.";
  if (err.message?.includes("Not enough lettuce")) return "Not enough quantity available.";
  return "Transaction failed. Check console for details.";
}

function shortenAddr(addr) {
  if (!addr || addr === ethers.ZeroAddress) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(Number(ts) * 1000).toLocaleString();
}

// ──────────────────────────────────────────────────────────────
//  Read saved market address (localStorage → env var → empty)
// ──────────────────────────────────────────────────────────────
function initMarketAddress() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && ethers.isAddress(saved)) return saved;
  } catch { /* SSR / private-browsing guard */ }
  const env = import.meta.env.VITE_LETTUCE_MARKET_ADDRESS;
  if (env && env !== "0xYourDeployedLettuceMarketAddressHere" && ethers.isAddress(env))
    return env;
  return "";
}

// ──────────────────────────────────────────────────────────────
//  App component
// ──────────────────────────────────────────────────────────────
export default function App() {
  // ── wallet / network ──────────────────────────────────────
  const [walletAddress, setWalletAddress] = useState("");
  const [chainId, setChainId]             = useState("");
  const [status, setStatus]               = useState("Not connected");
  const [darkMode, setDarkMode]           = useState(false);

  // ── market address (localStorage-backed) ─────────────────
  const [marketAddress, setMarketAddressState] = useState(initMarketAddress);
  const [manualAddrInput, setManualAddrInput]  = useState("");
  const [addrInputError, setAddrInputError]    = useState("");

  function saveMarketAddress(addr) {
    localStorage.setItem(LS_KEY, addr);
    setMarketAddressState(addr);
  }

  function clearMarketAddress() {
    localStorage.removeItem(LS_KEY);
    setMarketAddressState("");
    setProducts([]);
    setAuctions([]);
    setPromotions([]);
    setYodaBalance(null);
  }

  function handleManualSave() {
    const trimmed = manualAddrInput.trim();
    if (!ethers.isAddress(trimmed)) {
      setAddrInputError("Invalid Ethereum address.");
      return;
    }
    setAddrInputError("");
    saveMarketAddress(trimmed);
    setManualAddrInput("");
  }

  // ── data ──────────────────────────────────────────────────
  const [yodaBalance,   setYodaBalance]   = useState(null);
  const [products,      setProducts]      = useState([]);
  const [auctions,      setAuctions]      = useState([]);
  const [promotions,    setPromotions]    = useState([]);
  const [feePerDay,     setFeePerDay]     = useState(null);

  // ── loading flags ─────────────────────────────────────────
  const [loadingListings,   setLoadingListings]   = useState(false);
  const [loadingAuctions,   setLoadingAuctions]   = useState(false);
  const [loadingPromotions, setLoadingPromotions] = useState(false);

  // ── active tab ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("buy");

  // ── marketplace tx status ─────────────────────────────────
  const [txStatus, setTxStatus] = useState({ type: "", msg: "" });

  // ── deploy status ─────────────────────────────────────────
  const [deployStatus, setDeployStatus] = useState({ type: "", msg: "" });
  const [deploying, setDeploying]       = useState(false);

  // ── buy form ──────────────────────────────────────────────
  const [buyAmounts, setBuyAmounts] = useState({});

  // ── sell form ─────────────────────────────────────────────
  const [sellForm, setSellForm] = useState({
    pricePerUnit: "", quantity: "", category: "Romaine", quality: "Standard",
  });

  // ── auction forms ─────────────────────────────────────────
  const [auctionForm, setAuctionForm] = useState({
    quantity: "", startingBid: "", durationDays: "1", category: "Romaine", quality: "Standard",
  });
  const [bidForm, setBidForm]     = useState({ auctionId: "", bidAmount: "" });
  const [withdrawId, setWithdrawId] = useState("");

  // ── promote forms ─────────────────────────────────────────
  const [promoteListingForm, setPromoteListingForm] = useState({ listingId: "", durationDays: "1" });
  const [promoteAuctionForm, setPromoteAuctionForm] = useState({ auctionId: "", durationDays: "1" });

  // ──────────────────────────────────────────────────────────
  //  Derived
  // ──────────────────────────────────────────────────────────
  const isWrongNetwork    = walletAddress && chainId && chainId !== SEPOLIA_CHAIN_ID;
  // True only when build:contracts has run and both ABI + bytecode are populated
  const hasBytecode       = Boolean(LETTUCE_MARKET_BYTECODE) && DEPLOY_ABI.length > 0;

  // ──────────────────────────────────────────────────────────
  //  Contract helpers
  // ──────────────────────────────────────────────────────────
  async function getContracts() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer   = await provider.getSigner();
    const market   = new ethers.Contract(marketAddress, LETTUCE_MARKET_ABI, signer);
    const yoda     = new ethers.Contract(YODA_TOKEN_ADDRESS, ERC20_ABI, signer);
    return { provider, signer, market, yoda };
  }

  async function getReadonlyContracts() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const market   = new ethers.Contract(marketAddress, LETTUCE_MARKET_ABI, provider);
    const yoda     = new ethers.Contract(YODA_TOKEN_ADDRESS, ERC20_ABI, provider);
    return { provider, market, yoda };
  }

  // ──────────────────────────────────────────────────────────
  //  Sepolia helpers
  // ──────────────────────────────────────────────────────────
  async function ensureSepolia() {
    const cid = await window.ethereum.request({ method: "eth_chainId" });
    if (cid !== SEPOLIA_CHAIN_ID) {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    }
  }

  async function switchToSepolia() {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (err) {
      // Chain not added in MetaMask yet — add it with public Sepolia RPC
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId:         SEPOLIA_CHAIN_ID,
            chainName:       "Sepolia Testnet",
            nativeCurrency:  { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
            rpcUrls:         ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          }],
        });
      } else {
        setStatus("Could not switch to Sepolia: " + parseError(err));
      }
    }
  }

  async function ensureAllowance(yoda, owner, spender, amount) {
    const allowance = await yoda.allowance(owner, spender);
    if (allowance < amount) {
      setTxStatus({ type: "loading", msg: "Approving YODA spending…" });
      const tx = await yoda.approve(spender, amount);
      await tx.wait();
    }
  }

  // ──────────────────────────────────────────────────────────
  //  Wallet connect
  // ──────────────────────────────────────────────────────────
  async function connectWallet() {
    if (!window.ethereum) { setStatus("MetaMask not found"); return; }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const cid      = await window.ethereum.request({ method: "eth_chainId" });
      setWalletAddress(accounts[0]);
      setChainId(cid);
      setStatus("Wallet connected");
    } catch (err) {
      setStatus("Connection failed");
      console.error(err);
    }
  }

  // ──────────────────────────────────────────────────────────
  //  DEPLOY LETTUCE MARKET from browser
  // ──────────────────────────────────────────────────────────
  async function deployMarket() {
    if (!hasBytecode || !DEPLOY_ABI.length) {
      setDeployStatus({
        type: "error",
        msg: "Contract artifacts not available. Run 'npm run build:contracts' from the project root first.",
      });
      return;
    }
    if (!walletAddress) {
      setDeployStatus({ type: "error", msg: "Connect your wallet first." });
      return;
    }
    try {
      setDeploying(true);
      setDeployStatus({ type: "loading", msg: "Checking network…" });
      await ensureSepolia();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      // Use DEPLOY_ABI (full JSON from Hardhat artifact) — it includes the
      // constructor entry so ethers knows factory.deploy() takes an address arg.
      const factory  = new ethers.ContractFactory(DEPLOY_ABI, LETTUCE_MARKET_BYTECODE, signer);

      setDeployStatus({ type: "loading", msg: "MetaMask will ask you to confirm the deployment…" });
      const contract = await factory.deploy(YODA_TOKEN_ADDRESS);

      setDeployStatus({ type: "loading", msg: "Deploying — waiting for confirmation…" });
      await contract.waitForDeployment();

      const addr = await contract.getAddress();
      saveMarketAddress(addr);
      setDeployStatus({ type: "success", msg: `Deployed! LettuceMarket address: ${addr}` });
    } catch (err) {
      console.error(err);
      setDeployStatus({ type: "error", msg: parseError(err) });
    } finally {
      setDeploying(false);
    }
  }

  // ──────────────────────────────────────────────────────────
  //  Load data
  // ──────────────────────────────────────────────────────────
  const loadYodaBalance = useCallback(async () => {
    if (!walletAddress || !window.ethereum || !marketAddress) return;
    try {
      const { yoda } = await getReadonlyContracts();
      const raw = await yoda.balanceOf(walletAddress);
      setYodaBalance(formatYoda(raw));
    } catch (err) { console.error("loadYodaBalance:", err); }
  }, [walletAddress, marketAddress]);

  const loadListings = useCallback(async () => {
    if (!window.ethereum || !marketAddress) return;
    try {
      setLoadingListings(true);
      const { market } = await getReadonlyContracts();
      const total = await market.nextId();
      const loaded = [];
      for (let i = 0; i < Number(total); i++) {
        const item = await market.getLettuce(i);
        loaded.push({
          id:           Number(item.id),
          seller:       item.seller,
          pricePerUnit: item.pricePerUnit.toString(),
          quantity:     item.quantity.toString(),
          category:     item.category,
          quality:      item.quality,
        });
      }
      setProducts(loaded);
    } catch (err) { console.error("loadListings:", err); }
    finally { setLoadingListings(false); }
  }, [marketAddress]);

  const loadAuctions = useCallback(async () => {
    if (!window.ethereum || !marketAddress) return;
    try {
      setLoadingAuctions(true);
      const { market } = await getReadonlyContracts();
      const total = await market.nextAuctionId();
      const loaded = [];
      for (let i = 0; i < Number(total); i++) {
        const a = await market.getAuction(i);
        if (a.seller !== ethers.ZeroAddress) {
          loaded.push({
            id:            Number(a.id),
            seller:        a.seller,
            category:      a.category,
            quality:       a.quality,
            quantity:      a.quantity.toString(),
            startingBid:   a.startingBid.toString(),
            highestBid:    a.highestBid.toString(),
            highestBidder: a.highestBidder,
            endTime:       a.endTime.toString(),
            finalized:     a.finalized,
          });
        }
      }
      setAuctions(loaded);
    } catch (err) { console.error("loadAuctions:", err); }
    finally { setLoadingAuctions(false); }
  }, [marketAddress]);

  const loadPromotions = useCallback(async () => {
    if (!window.ethereum || !marketAddress) return;
    try {
      setLoadingPromotions(true);
      const { market } = await getReadonlyContracts();
      const [raw, fee] = await Promise.all([
        market.getActivePromotions(),
        market.promotionFeePerDay(),
      ]);
      setFeePerDay(fee.toString());
      setPromotions(raw.map((p) => ({
        isAuction: p.isAuction,
        listingId: p.listingId.toString(),
        seller:    p.seller,
        feePaid:   p.feePaid.toString(),
        expiresAt: p.expiresAt.toString(),
      })));
    } catch (err) { console.error("loadPromotions:", err); }
    finally { setLoadingPromotions(false); }
  }, [marketAddress]);

  const refreshAll = useCallback(async () => {
    setStatus("Refreshing…");
    await Promise.all([loadListings(), loadAuctions(), loadPromotions(), loadYodaBalance()]);
    setStatus(walletAddress ? "Wallet connected" : "Loaded");
  }, [loadListings, loadAuctions, loadPromotions, loadYodaBalance, walletAddress]);

  // ──────────────────────────────────────────────────────────
  //  Effects
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (window.ethereum && marketAddress) {
      loadListings();
      loadAuctions();
      loadPromotions();
    }
  }, [marketAddress]);

  useEffect(() => {
    if (walletAddress && marketAddress) {
      loadYodaBalance();
      setStatus("Wallet connected");
    }
  }, [walletAddress, marketAddress]);

  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accounts) => {
      setWalletAddress(accounts[0] || "");
      setYodaBalance(null);
    };
    const onChain = (cid) => {
      setChainId(cid);
      if (cid !== SEPOLIA_CHAIN_ID) setStatus("Wrong network — please switch to Sepolia");
    };
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged",    onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged",    onChain);
    };
  }, []);

  // ──────────────────────────────────────────────────────────
  //  Marketplace actions
  // ──────────────────────────────────────────────────────────
  async function handleBuy(item) {
    const rawAmt = buyAmounts[item.id] || "";
    const amt    = parseInt(rawAmt, 10);
    if (!rawAmt || isNaN(amt) || amt <= 0) {
      setTxStatus({ type: "error", msg: "Enter a valid quantity to buy." }); return;
    }
    if (amt > Number(item.quantity)) {
      setTxStatus({ type: "error", msg: `Only ${item.quantity} units available.` }); return;
    }
    if (!walletAddress) { setTxStatus({ type: "error", msg: "Connect your wallet first." }); return; }
    try {
      setTxStatus({ type: "loading", msg: "Preparing purchase…" });
      await ensureSepolia();
      let total = BigInt(item.pricePerUnit) * BigInt(amt);
      if (amt >= 10) total = total * 80n / 100n;
      const { market, yoda } = await getContracts();
      await ensureAllowance(yoda, walletAddress, marketAddress, total);
      setTxStatus({ type: "loading", msg: "Buying lettuce…" });
      const tx = await market.buyLettuce(item.id, amt);
      await tx.wait();
      setTxStatus({ type: "success", msg: `Bought ${amt} unit(s) for ${formatYoda(total)} YODA!` });
      setBuyAmounts((p) => ({ ...p, [item.id]: "" }));
      await Promise.all([loadListings(), loadYodaBalance()]);
    } catch (err) {
      console.error(err);
      setTxStatus({ type: "error", msg: parseError(err) });
    }
  }

  async function handleList(e) {
    e.preventDefault();
    if (!walletAddress) { setTxStatus({ type: "error", msg: "Connect your wallet first." }); return; }
    const { pricePerUnit, quantity, category, quality } = sellForm;
    if (!pricePerUnit || !quantity) { setTxStatus({ type: "error", msg: "Fill in all fields." }); return; }
    try {
      setTxStatus({ type: "loading", msg: "Listing lettuce…" });
      await ensureSepolia();
      const { market } = await getContracts();
      const tx = await market.listLettuce(parseYoda(pricePerUnit), parseInt(quantity, 10), category, quality);
      await tx.wait();
      setTxStatus({ type: "success", msg: "Listing created!" });
      setSellForm({ pricePerUnit: "", quantity: "", category: "Romaine", quality: "Standard" });
      await loadListings();
    } catch (err) {
      console.error(err);
      setTxStatus({ type: "error", msg: parseError(err) });
    }
  }

  async function handleCreateAuction(e) {
    e.preventDefault();
    if (!walletAddress) { setTxStatus({ type: "error", msg: "Connect your wallet first." }); return; }
    const { quantity, startingBid, durationDays, category, quality } = auctionForm;
    if (!quantity || !startingBid || !durationDays) {
      setTxStatus({ type: "error", msg: "Fill in all auction fields." }); return;
    }
    try {
      setTxStatus({ type: "loading", msg: "Creating auction…" });
      await ensureSepolia();
      const { market } = await getContracts();
      const tx = await market.listLettuceAuction(
        parseInt(quantity, 10), parseYoda(startingBid), parseInt(durationDays, 10), category, quality
      );
      await tx.wait();
      setTxStatus({ type: "success", msg: "Auction created!" });
      setAuctionForm({ quantity: "", startingBid: "", durationDays: "1", category: "Romaine", quality: "Standard" });
      await loadAuctions();
    } catch (err) {
      console.error(err);
      setTxStatus({ type: "error", msg: parseError(err) });
    }
  }

  async function handleBid(e) {
    e.preventDefault();
    if (!walletAddress) { setTxStatus({ type: "error", msg: "Connect your wallet first." }); return; }
    const { auctionId, bidAmount } = bidForm;
    if (!auctionId || !bidAmount) {
      setTxStatus({ type: "error", msg: "Enter auction ID and bid amount." }); return;
    }
    try {
      setTxStatus({ type: "loading", msg: "Placing bid…" });
      await ensureSepolia();
      const rawBid = parseYoda(bidAmount);
      const { market, yoda } = await getContracts();
      await ensureAllowance(yoda, walletAddress, marketAddress, rawBid);
      setTxStatus({ type: "loading", msg: "Submitting bid…" });
      const tx = await market.placeBid(parseInt(auctionId, 10), rawBid);
      await tx.wait();
      setTxStatus({ type: "success", msg: `Bid of ${bidAmount} YODA placed on auction #${auctionId}!` });
      setBidForm({ auctionId: "", bidAmount: "" });
      await Promise.all([loadAuctions(), loadYodaBalance()]);
    } catch (err) {
      console.error(err);
      setTxStatus({ type: "error", msg: parseError(err) });
    }
  }

  async function handleWithdraw(e) {
    e.preventDefault();
    if (!walletAddress) { setTxStatus({ type: "error", msg: "Connect your wallet first." }); return; }
    if (!withdrawId) { setTxStatus({ type: "error", msg: "Enter the auction ID." }); return; }
    try {
      setTxStatus({ type: "loading", msg: "Withdrawing tokens…" });
      await ensureSepolia();
      const { market } = await getContracts();
      const tx = await market.withdrawOutbidTokens(parseInt(withdrawId, 10));
      await tx.wait();
      setTxStatus({ type: "success", msg: `Tokens withdrawn from auction #${withdrawId}!` });
      setWithdrawId("");
      await loadYodaBalance();
    } catch (err) {
      console.error(err);
      setTxStatus({ type: "error", msg: parseError(err) });
    }
  }

  async function handleFinalize(auctionId) {
    if (!walletAddress) { setTxStatus({ type: "error", msg: "Connect your wallet first." }); return; }
    try {
      setTxStatus({ type: "loading", msg: `Finalizing auction #${auctionId}…` });
      await ensureSepolia();
      const { market } = await getContracts();
      const tx = await market.finalizeAuction(auctionId);
      await tx.wait();
      setTxStatus({ type: "success", msg: `Auction #${auctionId} finalized!` });
      await Promise.all([loadAuctions(), loadYodaBalance()]);
    } catch (err) {
      console.error(err);
      setTxStatus({ type: "error", msg: parseError(err) });
    }
  }

  async function handlePromoteListing(e) {
    e.preventDefault();
    if (!walletAddress) { setTxStatus({ type: "error", msg: "Connect your wallet first." }); return; }
    const { listingId, durationDays } = promoteListingForm;
    if (!listingId || !durationDays) {
      setTxStatus({ type: "error", msg: "Enter listing ID and duration." }); return;
    }
    try {
      setTxStatus({ type: "loading", msg: "Promoting listing…" });
      await ensureSepolia();
      const days = parseInt(durationDays, 10);
      const fee  = BigInt(feePerDay || "0") * BigInt(days);
      const { market, yoda } = await getContracts();
      await ensureAllowance(yoda, walletAddress, marketAddress, fee);
      setTxStatus({ type: "loading", msg: "Submitting promotion…" });
      const tx = await market.promoteListing(parseInt(listingId, 10), days);
      await tx.wait();
      setTxStatus({ type: "success", msg: `Listing #${listingId} promoted for ${days} day(s)!` });
      setPromoteListingForm({ listingId: "", durationDays: "1" });
      await Promise.all([loadPromotions(), loadYodaBalance()]);
    } catch (err) {
      console.error(err);
      setTxStatus({ type: "error", msg: parseError(err) });
    }
  }

  async function handlePromoteAuction(e) {
    e.preventDefault();
    if (!walletAddress) { setTxStatus({ type: "error", msg: "Connect your wallet first." }); return; }
    const { auctionId, durationDays } = promoteAuctionForm;
    if (!auctionId || !durationDays) {
      setTxStatus({ type: "error", msg: "Enter auction ID and duration." }); return;
    }
    try {
      setTxStatus({ type: "loading", msg: "Promoting auction…" });
      await ensureSepolia();
      const days = parseInt(durationDays, 10);
      const fee  = BigInt(feePerDay || "0") * BigInt(days);
      const { market, yoda } = await getContracts();
      await ensureAllowance(yoda, walletAddress, marketAddress, fee);
      setTxStatus({ type: "loading", msg: "Submitting promotion…" });
      const tx = await market.promoteAuction(parseInt(auctionId, 10), days);
      await tx.wait();
      setTxStatus({ type: "success", msg: `Auction #${auctionId} promoted for ${days} day(s)!` });
      setPromoteAuctionForm({ auctionId: "", durationDays: "1" });
      await Promise.all([loadPromotions(), loadYodaBalance()]);
    } catch (err) {
      console.error(err);
      setTxStatus({ type: "error", msg: parseError(err) });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  Shared sub-components
  //  Called as functions (not JSX) to avoid React remounting
  //  inner components on every parent state change.
  // ──────────────────────────────────────────────────────────
  function TxMsg() {
    if (!txStatus.msg) return null;
    return (
      <div className={`tx-msg tx-msg-${txStatus.type}`}>
        {txStatus.type === "loading" && <span className="spinner" />}
        {txStatus.msg}
        {txStatus.type !== "loading" && (
          <button className="tx-close" onClick={() => setTxStatus({ type: "", msg: "" })}>✕</button>
        )}
      </div>
    );
  }

  function BuyAmountRow({ item }) {
    const amt = buyAmounts[item.id] || "";
    const n   = parseInt(amt, 10);
    let total = null, discounted = false;
    if (!isNaN(n) && n > 0) {
      let raw = BigInt(item.pricePerUnit) * BigInt(n);
      if (n >= 10) { raw = raw * 80n / 100n; discounted = true; }
      total = formatYoda(raw);
    }
    return (
      <div className="buy-row">
        <input
          type="number" className="buy-input" placeholder="Qty" min="1" max={item.quantity}
          value={amt}
          onChange={(e) => setBuyAmounts((p) => ({ ...p, [item.id]: e.target.value }))}
        />
        <div className="buy-total">
          {total != null ? (
            <>
              <span className="total-label">Total:</span>
              <span className="total-value">{total} YODA</span>
              {discounted && <span className="discount-tag">20% bulk off</span>}
            </>
          ) : (
            <span className="total-placeholder">Enter qty</span>
          )}
        </div>
        <button className="buy-btn" onClick={() => handleBuy(item)}>Buy Now</button>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  //  DEPLOY PANEL (shown when no marketAddress)
  // ──────────────────────────────────────────────────────────
  function DeployPanel() {
    return (
      <div className="deploy-panel">
        <h2 className="deploy-panel-title">Set Up Your Marketplace</h2>
        <p className="deploy-panel-sub">
          No LettuceMarket contract is configured yet. Deploy one with MetaMask
          or paste an existing address to get started.
        </p>

        {/* Step indicators */}
        <div className="deploy-steps">
          <div className={`deploy-step ${walletAddress ? "step-done" : "step-pending"}`}>
            <span className="step-num">{walletAddress ? "✓" : "1"}</span>
            <span className="step-label">
              {walletAddress ? `Connected: ${shortenAddr(walletAddress)}` : "Connect Wallet"}
            </span>
            {!walletAddress && (
              <button className="action-btn action-btn-sm" onClick={connectWallet}>
                Connect
              </button>
            )}
          </div>

          <div className={`deploy-step ${
            walletAddress && chainId === SEPOLIA_CHAIN_ID ? "step-done" : "step-pending"
          }`}>
            <span className="step-num">
              {walletAddress && chainId === SEPOLIA_CHAIN_ID ? "✓" : "2"}
            </span>
            <span className="step-label">
              {walletAddress && chainId === SEPOLIA_CHAIN_ID
                ? "On Sepolia"
                : "Switch to Sepolia"}
            </span>
            {walletAddress && chainId !== SEPOLIA_CHAIN_ID && (
              <button className="network-switch-btn" onClick={switchToSepolia}>
                Switch
              </button>
            )}
          </div>

          <div className={`deploy-step ${hasBytecode ? "step-done" : "step-warn"}`}>
            <span className="step-num">{hasBytecode ? "✓" : "3"}</span>
            <span className="step-label">
              {hasBytecode
                ? "Contract bytecode ready"
                : "Run: npm run build:contracts"}
            </span>
          </div>
        </div>

        {/* Deploy status */}
        {deployStatus.msg && (
          <div className={`tx-msg tx-msg-${deployStatus.type} deploy-status-msg`}>
            {deployStatus.type === "loading" && <span className="spinner" />}
            {deployStatus.msg}
          </div>
        )}

        {/* Deploy button */}
        <button
          className="action-btn deploy-btn"
          onClick={deployMarket}
          disabled={deploying || !walletAddress || !hasBytecode || isWrongNetwork}
        >
          {deploying ? <><span className="spinner" /> Deploying…</> : "Deploy LettuceMarket"}
        </button>

        <div className="deploy-divider"><span>or paste existing address</span></div>

        {/* Manual address entry */}
        <div className="manual-addr-row">
          <input
            className="form-input manual-addr-input"
            type="text"
            placeholder="0x…  existing LettuceMarket address"
            value={manualAddrInput}
            onChange={(e) => { setManualAddrInput(e.target.value); setAddrInputError(""); }}
            spellCheck={false}
          />
          <button className="action-btn action-btn-secondary" onClick={handleManualSave}>
            Use This Address
          </button>
        </div>
        {addrInputError && <p className="addr-error">{addrInputError}</p>}

        <p className="deploy-note">
          You need Sepolia ETH in MetaMask to pay gas. Get some from a{" "}
          <a
            href="https://sepoliafaucet.com"
            target="_blank"
            rel="noopener noreferrer"
            className="deploy-link"
          >
            Sepolia faucet
          </a>.
        </p>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  //  TAB: BUY
  // ──────────────────────────────────────────────────────────
  const availableListings = products.filter((p) => Number(p.quantity) > 0);

  function BuyTab() {
    if (loadingListings) return <div className="loading-state"><div className="loading-spinner-large" /><p>Fetching listings…</p></div>;
    if (availableListings.length === 0) return (
      <div className="empty-state">
        <h3>No listings yet</h3>
        <p>Be the first to list your lettuce in the Sell tab.</p>
      </div>
    );
    return (
      <div className="product-grid">
        {availableListings.map((item) => (
          <div className="card" key={item.id}>
            <div className="card-header">
              <span className={`quality-badge ${qualityClass(item.quality)}`}>
                {item.quality}
              </span>
              <span className="id-tag">#{item.id}</span>
            </div>
            <div className="card-body">
              <h3 className="card-title">{item.category} Lettuce</h3>
              <div className="card-details">
                <div className="detail-row">
                  <div>
                    <span className="detail-label">Price per unit</span>
                    <span className="detail-value price-value">{formatYoda(item.pricePerUnit)} YODA</span>
                  </div>
                </div>
                <div className="detail-row">
                  <div>
                    <span className="detail-label">Available</span>
                    <span className="detail-value">{item.quantity} units</span>
                  </div>
                </div>
                <div className="detail-row">
                  <div>
                    <span className="detail-label">Seller</span>
                    <span className="detail-value address-value">{shortenAddr(item.seller)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-footer card-footer-buy">
              <span className="bulk-note">Buy 10+ for a 20% bulk discount</span>
              {BuyAmountRow({ item })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  //  TAB: SELL
  // ──────────────────────────────────────────────────────────
  const myListings = walletAddress
    ? products.filter((p) => p.seller.toLowerCase() === walletAddress.toLowerCase())
    : [];

  function SellTab() {
    return (
      <div className="tab-panels">
        <div className="form-panel">
          <h3 className="form-title">List Your Lettuce</h3>
          <form onSubmit={handleList} className="form-grid">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Price per unit (YODA)</label>
                <input className="form-input" type="number" step="0.01" min="0.01" placeholder="e.g. 5.00"
                  value={sellForm.pricePerUnit}
                  onChange={(e) => setSellForm((f) => ({ ...f, pricePerUnit: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Quantity (units)</label>
                <input className="form-input" type="number" min="1" placeholder="e.g. 50"
                  value={sellForm.quantity}
                  onChange={(e) => setSellForm((f) => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={sellForm.category}
                  onChange={(e) => setSellForm((f) => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quality</label>
                <select className="form-input" value={sellForm.quality}
                  onChange={(e) => setSellForm((f) => ({ ...f, quality: e.target.value }))}>
                  {QUALITIES.map((q) => <option key={q}>{q}</option>)}
                </select>
              </div>
            </div>
            <button className="action-btn" type="submit">List Lettuce</button>
          </form>
        </div>

        {myListings.length > 0 && (
          <div className="my-listings">
            <h3 className="form-title" style={{ marginBottom: "16px" }}>Your Listings</h3>
            <div className="product-grid">
              {myListings.map((item) => (
                <div className="card" key={item.id}>
                  <div className="card-header">
                    <span className={`quality-badge ${qualityClass(item.quality)}`}>
                      {item.quality}
                    </span>
                    <span className="id-tag">#{item.id}</span>
                  </div>
                  <div className="card-body">
                    <h3 className="card-title">{item.category} Lettuce</h3>
                    <div className="card-details">
                      <div className="detail-row">
                        <div>
                          <span className="detail-label">Price per unit</span>
                          <span className="detail-value price-value">{formatYoda(item.pricePerUnit)} YODA</span>
                        </div>
                      </div>
                      <div className="detail-row">
                        <div>
                          <span className="detail-label">Remaining</span>
                          <span className="detail-value">{item.quantity} units</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card-footer">
                    <span className="status-tag">{Number(item.quantity) > 0 ? "Active" : "Sold out"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  //  TAB: AUCTIONS
  // ──────────────────────────────────────────────────────────
  function AuctionsTab() {
    const now = Math.floor(Date.now() / 1000);
    return (
      <div className="tab-panels">
        <div className="form-panel">
          <h3 className="form-title">Create Auction</h3>
          <form onSubmit={handleCreateAuction} className="form-grid">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className="form-input" type="number" min="1" placeholder="20"
                  value={auctionForm.quantity}
                  onChange={(e) => setAuctionForm((f) => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Starting Bid (YODA)</label>
                <input className="form-input" type="number" step="0.01" min="0.01" placeholder="10.00"
                  value={auctionForm.startingBid}
                  onChange={(e) => setAuctionForm((f) => ({ ...f, startingBid: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Duration (days)</label>
                <input className="form-input" type="number" min="1" placeholder="1"
                  value={auctionForm.durationDays}
                  onChange={(e) => setAuctionForm((f) => ({ ...f, durationDays: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={auctionForm.category}
                  onChange={(e) => setAuctionForm((f) => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quality</label>
                <select className="form-input" value={auctionForm.quality}
                  onChange={(e) => setAuctionForm((f) => ({ ...f, quality: e.target.value }))}>
                  {QUALITIES.map((q) => <option key={q}>{q}</option>)}
                </select>
              </div>
            </div>
            <button className="action-btn" type="submit">Create Auction</button>
          </form>
        </div>

        <div className="form-row-group">
          <div className="form-panel form-panel-sm">
            <h3 className="form-title">Place Bid</h3>
            <form onSubmit={handleBid} className="form-grid">
              <div className="form-group">
                <label className="form-label">Auction ID</label>
                <input className="form-input" type="number" min="0" placeholder="0"
                  value={bidForm.auctionId}
                  onChange={(e) => setBidForm((f) => ({ ...f, auctionId: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Bid Amount (YODA)</label>
                <input className="form-input" type="number" step="0.01" min="0.01" placeholder="15.00"
                  value={bidForm.bidAmount}
                  onChange={(e) => setBidForm((f) => ({ ...f, bidAmount: e.target.value }))} />
              </div>
              <button className="action-btn" type="submit">Place Bid</button>
            </form>
          </div>
          <div className="form-panel form-panel-sm">
            <h3 className="form-title">Withdraw Outbid Tokens</h3>
            <form onSubmit={handleWithdraw} className="form-grid">
              <div className="form-group">
                <label className="form-label">Auction ID</label>
                <input className="form-input" type="number" min="0" placeholder="0"
                  value={withdrawId}
                  onChange={(e) => setWithdrawId(e.target.value)} />
              </div>
              <button className="action-btn action-btn-secondary" type="submit">Withdraw</button>
            </form>
          </div>
        </div>

        {loadingAuctions ? (
          <div className="loading-state"><div className="loading-spinner-large" /><p>Loading auctions…</p></div>
        ) : auctions.length === 0 ? (
          <div className="empty-state">
            <h3>No auctions yet</h3>
            <p>Create the first lettuce auction above.</p>
          </div>
        ) : (
          <div className="auction-grid">
            {auctions.map((a) => {
              const active = !a.finalized && Number(a.endTime) > now;
              const ended  = !a.finalized && Number(a.endTime) <= now;
              return (
                <div className="card auction-card" key={a.id}>
                  <div className="card-header">
                    <span className={`quality-badge ${qualityClass(a.quality)}`}>
                      {a.quality}
                    </span>
                    <div className="auction-meta">
                      <span className="id-tag">#{a.id}</span>
                      <span className={`auction-status-tag ${a.finalized ? "tag-finalized" : active ? "tag-active" : "tag-ended"}`}>
                        {a.finalized ? "Finalized" : active ? "Active" : "Ended"}
                      </span>
                    </div>
                  </div>
                  <div className="card-body">
                    <h3 className="card-title">{a.category} Lettuce</h3>
                    <div className="card-details">
                      <div className="detail-row"><div><span className="detail-label">Quantity</span><span className="detail-value">{a.quantity} units</span></div></div>
                      <div className="detail-row"><div><span className="detail-label">Starting bid</span><span className="detail-value price-value">{formatYoda(a.startingBid)} YODA</span></div></div>
                      <div className="detail-row"><div><span className="detail-label">Highest bid</span><span className="detail-value price-value">{BigInt(a.highestBid) > 0n ? formatYoda(a.highestBid) + " YODA" : "No bids yet"}</span></div></div>
                      {a.highestBidder !== ethers.ZeroAddress && (
                        <div className="detail-row"><div><span className="detail-label">Highest bidder</span><span className="detail-value address-value">{shortenAddr(a.highestBidder)}</span></div>
                        </div>
                      )}
                      <div className="detail-row"><div><span className="detail-label">Ends</span><span className="detail-value">{formatDate(a.endTime)}</span></div></div>
                      <div className="detail-row"><div><span className="detail-label">Seller</span><span className="detail-value address-value">{shortenAddr(a.seller)}</span></div></div>
                    </div>
                  </div>
                  {ended && (
                    <div className="card-footer">
                      <button className="action-btn action-btn-sm" onClick={() => handleFinalize(a.id)}>
                        Finalize Auction
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  //  TAB: PROMOTIONS
  // ──────────────────────────────────────────────────────────
  function PromotionsTab() {
    const dailyFeeDisplay = feePerDay ? formatYoda(feePerDay) : "—";
    return (
      <div className="tab-panels">
        <div className="promo-fee-banner">
          <div>
            <span className="promo-fee-label">Current promotion fee:</span>
            <span className="promo-fee-value">{dailyFeeDisplay} YODA / day</span>
          </div>
        </div>
        <div className="form-row-group">
          <div className="form-panel form-panel-sm">
            <h3 className="form-title">Promote a Listing</h3>
            <form onSubmit={handlePromoteListing} className="form-grid">
              <div className="form-group">
                <label className="form-label">Listing ID</label>
                <input className="form-input" type="number" min="0" placeholder="0"
                  value={promoteListingForm.listingId}
                  onChange={(e) => setPromoteListingForm((f) => ({ ...f, listingId: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Duration (days)</label>
                <input className="form-input" type="number" min="1" placeholder="1"
                  value={promoteListingForm.durationDays}
                  onChange={(e) => setPromoteListingForm((f) => ({ ...f, durationDays: e.target.value }))} />
              </div>
              {feePerDay && promoteListingForm.durationDays && (
                <p className="fee-estimate">Cost: {formatYoda(BigInt(feePerDay) * BigInt(promoteListingForm.durationDays || 1))} YODA</p>
              )}
              <button className="action-btn" type="submit">Promote Listing</button>
            </form>
          </div>
          <div className="form-panel form-panel-sm">
            <h3 className="form-title">Promote an Auction</h3>
            <form onSubmit={handlePromoteAuction} className="form-grid">
              <div className="form-group">
                <label className="form-label">Auction ID</label>
                <input className="form-input" type="number" min="0" placeholder="0"
                  value={promoteAuctionForm.auctionId}
                  onChange={(e) => setPromoteAuctionForm((f) => ({ ...f, auctionId: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Duration (days)</label>
                <input className="form-input" type="number" min="1" placeholder="1"
                  value={promoteAuctionForm.durationDays}
                  onChange={(e) => setPromoteAuctionForm((f) => ({ ...f, durationDays: e.target.value }))} />
              </div>
              {feePerDay && promoteAuctionForm.durationDays && (
                <p className="fee-estimate">Cost: {formatYoda(BigInt(feePerDay) * BigInt(promoteAuctionForm.durationDays || 1))} YODA</p>
              )}
              <button className="action-btn" type="submit">Promote Auction</button>
            </form>
          </div>
        </div>

        <h3 className="form-title" style={{ marginTop: "8px" }}>Active Promotions</h3>
        {loadingPromotions ? (
          <div className="loading-state" style={{ padding: "48px 32px" }}><div className="loading-spinner-large" /><p>Loading promotions…</p></div>
        ) : promotions.length === 0 ? (
          <div className="empty-state" style={{ padding: "48px 32px" }}>
            <h3>No active promotions</h3>
            <p>Promote a listing or auction to boost visibility.</p>
          </div>
        ) : (
          <div className="promo-list">
            {promotions.map((p, idx) => (
              <div className="promo-item" key={idx}>
                <div className="promo-type-badge">{p.isAuction ? "Auction" : "Listing"} #{p.listingId}</div>
                <div className="promo-details">
                  <div className="promo-row"><span className="detail-label">Seller</span><span className="detail-value address-value">{shortenAddr(p.seller)}</span></div>
                  <div className="promo-row"><span className="detail-label">Fee paid</span><span className="detail-value price-value">{formatYoda(p.feePaid)} YODA</span></div>
                  <div className="promo-row"><span className="detail-label">Expires</span><span className="detail-value">{formatDate(p.expiresAt)}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  //  Derived display values
  // ──────────────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  const activeAuctionsCount = auctions.filter((a) => !a.finalized && Number(a.endTime) > now).length;

  // ──────────────────────────────────────────────────────────
  //  Main render
  // ──────────────────────────────────────────────────────────
  return (
    <div className={`app ${darkMode ? "dark" : "light"}`}>

      {/* ── Navbar ───────────────────────────────────────── */}
      <nav className="navbar">
        <div className="nav-brand">
          <span className="brand-name">YodaMart</span>
        </div>

        <div className="nav-actions">
          {yodaBalance !== null && (
            <div className="yoda-balance-badge">
              <span>{yodaBalance} YODA</span>
            </div>
          )}

          <button className="theme-toggle" onClick={() => setDarkMode((d) => !d)}
            title="Toggle light / dark mode" aria-label="Toggle theme">
            {darkMode ? "Light" : "Dark"}
          </button>

          <button className="connect-btn" onClick={connectWallet}>
            {walletAddress ? (
              <><span className="dot connected" />{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</>
            ) : "Connect Wallet"}
          </button>
        </div>
      </nav>

      {/* ── Wrong network warning ───────────────────────── */}
      {isWrongNetwork && (
        <div className="network-warning">
          <span>Wrong network — this app runs on Sepolia.</span>
          <button className="network-switch-btn" onClick={switchToSepolia}>Switch to Sepolia</button>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-dot" />
            The Future Of Agriculture
          </div>
          <h1 className="hero-title">
            Fresh Lettuce,<br />
            <span className="gradient-text">On-Chain</span>
          </h1>
          <p className="hero-subtitle">
            Buy and sell premium lettuce using Yoda tokens in a
            decentralized grocery-style marketplace powered by Ethereum.
          </p>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">{availableListings.length}</span>
              <span className="stat-label">Listings</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">{activeAuctionsCount}</span>
              <span className="stat-label">Auctions</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">{yodaBalance ?? "—"}</span>
              <span className="stat-label">YODA Balance</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">Sepolia</span>
              <span className="stat-label">Network</span>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card-float">
            <div className="float-label">Lettuce Market</div>
            <div className="float-sub">Fresh · Verified · On-Chain</div>
            <span className="float-badge">Live Pricing</span>
          </div>
        </div>
      </header>

      {/* ── Status Bar ───────────────────────────────────── */}
      <div className={`status-bar ${statusVariant(status, walletAddress)}`}>
        <span className="status-dot" />
        {status}
        {walletAddress && (
          <span className="status-address"> · {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
        )}
      </div>

      {/* ── About ────────────────────────────────────────── */}
      <section className="about-section">
        <div className="about-content">
          <h2>About YodaMart</h2>
          <p>
            A decentralized platform where farmers list lettuce by unit, bundle, or bulk quantity.
            Supports bulk discounts, auctions, and promotional offers. Powered by the YODA token on
            Sepolia. Deploy the marketplace contract once from your browser — no Remix, no Alchemy,
            no private key setup.
          </p>
        </div>
      </section>

      {/* ── Marketplace / Deploy Panel ───────────────────── */}
      <section className="products-section">

        {!marketAddress ? (
          /* ── No contract configured — show deploy panel ── */
          DeployPanel()
        ) : (
          /* ── Contract configured — show full marketplace ─ */
          <>
            <div className="section-header">
              <div>
                <h2>Marketplace</h2>
                <p className="section-subtitle">
                  {shortenAddr(marketAddress)}
                  <button className="change-addr-btn" onClick={clearMarketAddress} title="Change marketplace address">
                    ✕ Change
                  </button>
                </p>
              </div>
              <button
                className="refresh-btn"
                onClick={refreshAll}
                disabled={loadingListings || loadingAuctions || loadingPromotions}
              >
                {(loadingListings || loadingAuctions || loadingPromotions)
                  ? <span className="spinner" /> : "↻"}{" "}Refresh
              </button>
            </div>

            {TxMsg()}

            <div className="tab-bar">
              {[
                { key: "buy",        label: "Buy" },
                { key: "sell",       label: "Sell" },
                { key: "auctions",   label: "Auctions" },
                { key: "promotions", label: "Promotions" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={`tab-btn ${activeTab === key ? "tab-btn-active" : ""}`}
                  onClick={() => { setActiveTab(key); setTxStatus({ type: "", msg: "" }); }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="tab-content">
              {activeTab === "buy"        && BuyTab()}
              {activeTab === "sell"       && SellTab()}
              {activeTab === "auctions"   && AuctionsTab()}
              {activeTab === "promotions" && PromotionsTab()}
            </div>
          </>
        )}
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-brand">
          YodaMart — Decentralized Lettuce Marketplace
        </div>
        <div>Powered by Ethereum · Yoda Token · Sepolia</div>
      </footer>
    </div>
  );
}
