import { useEffect, useState } from "react";
import { ethers } from "ethers";
import "./App.css";
import {
  LETTUCE_MARKET_ADDRESS,
  LETTUCE_MARKET_ABI,
} from "./contractConfig";

/* Map quality labels to emoji */
const QUALITY_EMOJI = {
  Premium:  "🥇",
  Standard: "🌿",
  Economy:  "🥬",
};

/* Derive a CSS class from quality label */
function qualityClass(q) {
  if (!q) return "";
  return "quality-" + q.toLowerCase();
}

/* Classify status string for colour coding */
function statusVariant(status, walletAddress) {
  const s = status.toLowerCase();
  if (s.includes("fail") || s.includes("not found") || s.includes("error"))
    return "status-error";
  if (walletAddress || s.includes("loaded") || s.includes("connected"))
    return "status-success";
  return "status-info";
}

function App() {
  const [walletAddress, setWalletAddress]     = useState("");
  const [status, setStatus]                   = useState("Not connected");
  const [products, setProducts]               = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [darkMode, setDarkMode]               = useState(false);

  /* ── Wallet ── */
  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("MetaMask not found");
      return;
    }
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setWalletAddress(accounts[0]);
      setStatus("Wallet connected");
    } catch (err) {
      console.error(err);
      setStatus("Connection failed");
    }
  }

  /* ── Load on-chain listings ── */
  async function loadListingsFromContract() {
    if (!window.ethereum) {
      setStatus("MetaMask not found");
      return;
    }
    if (
      !LETTUCE_MARKET_ADDRESS ||
      LETTUCE_MARKET_ADDRESS === "0xYourDeployedLettuceMarketAddressHere"
    ) {
      setStatus("Add deployed contract address in contractConfig.js");
      return;
    }

    try {
      setLoadingListings(true);
      setStatus("Loading listings…");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        LETTUCE_MARKET_ADDRESS,
        LETTUCE_MARKET_ABI,
        provider
      );

      const total = await contract.nextId();
      const loaded = [];

      for (let i = 0; i < Number(total); i++) {
        const item = await contract.getLettuce(i);
        if (Number(item.quantity) > 0) {
          loaded.push({
            id:           Number(item.id),
            seller:       item.seller,
            pricePerUnit: item.pricePerUnit.toString(),
            quantity:     item.quantity.toString(),
            category:     item.category,
            quality:      item.quality,
          });
        }
      }

      setProducts(loaded);
      setStatus(
        loaded.length === 0
          ? "No listings found on contract"
          : `${loaded.length} listing${loaded.length > 1 ? "s" : ""} loaded`
      );
    } catch (err) {
      console.error(err);
      setStatus("Failed to load listings");
      setProducts([]);
    } finally {
      setLoadingListings(false);
    }
  }

  useEffect(() => {
    if (window.ethereum) {
      loadListingsFromContract();
    }
  }, []);

  /* ── Render ── */
  return (
    <div className={`app ${darkMode ? "dark" : "light"}`}>

      {/* ── Navbar ─────────────────────────────────── */}
      <nav className="navbar">
        <div className="nav-brand">
          <span className="brand-icon">🥬</span>
          <span className="brand-name">YodaMart</span>
        </div>

        <div className="nav-actions">
          <button
            className="theme-toggle"
            onClick={() => setDarkMode((d) => !d)}
            title="Toggle light / dark mode"
            aria-label="Toggle theme"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>

          <button className="connect-btn" onClick={connectWallet}>
            {walletAddress ? (
              <>
                <span className="dot connected" />
                {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
              </>
            ) : (
              "Connect Wallet"
            )}
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────── */}
      <header className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-dot" />
            Decentralized Marketplace
          </div>

          <h1 className="hero-title">
            Fresh Lettuce,
            <br />
            <span className="gradient-text">On-Chain</span>
          </h1>

          <p className="hero-subtitle">
            Buy and sell premium lettuce using Yoda tokens in a
            decentralized grocery-style marketplace powered by Ethereum.
          </p>

          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">{products.length}</span>
              <span className="stat-label">Listings</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">YODA</span>
              <span className="stat-label">Token</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">ETH</span>
              <span className="stat-label">Network</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-card-float">
            <span className="float-icon">🥬</span>
            <div className="float-label">Lettuce Market</div>
            <div className="float-sub">Fresh · Verified · On-Chain</div>
            <span className="float-badge">Live Pricing</span>
          </div>
        </div>
      </header>

      {/* ── Status Bar ─────────────────────────────── */}
      <div className={`status-bar ${statusVariant(status, walletAddress)}`}>
        <span className="status-dot" />
        {status}
        {walletAddress && (
          <span className="status-address">
            {" "}· {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
          </span>
        )}
      </div>

      {/* ── About ──────────────────────────────────── */}
      <section className="about-section">
        <span className="about-icon">🌱</span>
        <div className="about-content">
          <h2>About YodaMart</h2>
          <p>
            A decentralized platform where farmers list lettuce by unit, bundle,
            or bulk quantity — giving buyers flexible purchasing options.
            Supports bulk discounts, bundle deals, and promotional offers for a
            realistic on-chain grocery experience.
          </p>
        </div>
      </section>

      {/* ── Listings ───────────────────────────────── */}
      <section className="products-section">
        <div className="section-header">
          <div>
            <h2>Available Listings</h2>
            <p className="section-subtitle">Fresh produce, verified on-chain</p>
          </div>
          <button
            className="refresh-btn"
            onClick={loadListingsFromContract}
            disabled={loadingListings}
          >
            {loadingListings ? (
              <span className="spinner" />
            ) : (
              "↻"
            )}{" "}
            Refresh
          </button>
        </div>

        {loadingListings ? (
          <div className="loading-state">
            <div className="loading-spinner-large" />
            <p>Fetching listings from the blockchain…</p>
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🥬</span>
            <h3>No listings yet</h3>
            <p>Be the first to list your lettuce on the market.</p>
          </div>
        ) : (
          <div className="product-grid">
            {products.map((item) => (
              <div className="card" key={item.id}>
                {/* Card header */}
                <div className="card-header">
                  <span className={`quality-badge ${qualityClass(item.quality)}`}>
                    {QUALITY_EMOJI[item.quality] ?? "🥬"} {item.quality}
                  </span>
                  <span className="id-tag">#{item.id}</span>
                </div>

                {/* Card body */}
                <div className="card-body">
                  <div className="card-category-icon">🥬</div>
                  <h3 className="card-title">{item.category} Lettuce</h3>

                  <div className="card-details">
                    <div className="detail-row">
                      <span className="detail-icon">💰</span>
                      <div>
                        <span className="detail-label">Price per unit</span>
                        <span className="detail-value price-value">
                          {item.pricePerUnit} YODA
                        </span>
                      </div>
                    </div>

                    <div className="detail-row">
                      <span className="detail-icon">📦</span>
                      <div>
                        <span className="detail-label">Available quantity</span>
                        <span className="detail-value">{item.quantity} units</span>
                      </div>
                    </div>

                    <div className="detail-row">
                      <span className="detail-icon">👤</span>
                      <div>
                        <span className="detail-label">Seller</span>
                        <span className="detail-value address-value">
                          {item.seller.slice(0, 6)}…{item.seller.slice(-4)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card footer */}
                <div className="card-footer">
                  <span className="bulk-note">
                    <span className="bulk-icon">⚡</span>
                    Bulk 10+ units may receive discounts
                  </span>
                  <button className="buy-btn">Buy Now</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-brand">
          <span>🥬</span>
          YodaMart — Decentralized Lettuce Marketplace
        </div>
        <div>Powered by Ethereum · Yoda Token</div>
      </footer>
    </div>
  );
}

export default App;
