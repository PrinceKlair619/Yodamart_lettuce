import { useEffect, useState } from "react";
import { ethers } from "ethers";
import "./App.css";
import {
  LETTUCE_MARKET_ADDRESS,
  LETTUCE_MARKET_ABI,
} from "./contractConfig";

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [status, setStatus] = useState("Not connected");
  const [products, setProducts] = useState([
    {
      id: 0,
      seller: "0x1234...abcd",
      pricePerUnit: "15",
      quantity: "25",
      category: "Romaine",
      quality: "Premium",
    },
    {
      id: 1,
      seller: "0x5678...efgh",
      pricePerUnit: "10",
      quantity: "40",
      category: "Iceberg",
      quality: "Standard",
    },
    {
      id: 2,
      seller: "0x9999...aaaa",
      pricePerUnit: "20",
      quantity: "12",
      category: "Green Leaf",
      quality: "Organic",
    },
  ]);

  const [buyAmounts, setBuyAmounts] = useState({});
  const [loading, setLoading] = useState(false);

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
    } catch (error) {
      console.error(error);
      setStatus("Wallet connection failed");
    }
  }

  async function loadListingsFromContract() {
    if (!window.ethereum) return;

    try {
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

        loaded.push({
          id: Number(item.id),
          seller: item.seller,
          pricePerUnit: item.pricePerUnit.toString(),
          quantity: item.quantity.toString(),
          category: item.category,
          quality: item.quality,
        });
      }

      setProducts(loaded);
      setStatus("Loaded listings from contract");
    } catch (error) {
      console.error(error);
      setStatus("Using sample data until contract is deployed");
    }
  }

  async function buyLettuce(id) {
    if (!window.ethereum) {
      setStatus("MetaMask not found");
      return;
    }

    const amount = buyAmounts[id];

    if (!amount || Number(amount) <= 0) {
      setStatus("Enter a valid amount");
      return;
    }

    try {
      setLoading(true);
      setStatus("Preparing transaction...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(
        LETTUCE_MARKET_ADDRESS,
        LETTUCE_MARKET_ABI,
        signer
      );

      const tx = await contract.buyLettuce(id, Number(amount));
      setStatus("Transaction sent. Waiting for confirmation...");
      await tx.wait();

      setStatus("Purchase successful");
      await loadListingsFromContract();
    } catch (error) {
      console.error(error);
      setStatus("Purchase failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadListingsFromContract();
  }, []);

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-text">
          <p className="eyebrow">YodaMart Decentralized Marketplace</p>
          <h1>Lettuce Market</h1>
          <p className="subtitle">
            Buy and sell lettuce using Yoda tokens in a decentralized grocery
            style marketplace.
          </p>
        </div>

        <div className="wallet-box">
          <button className="connect-btn" onClick={connectWallet}>
            Connect Wallet
          </button>
          <p className="wallet-status">{status}</p>
          {walletAddress && (
            <p className="wallet-address">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </p>
          )}
        </div>
      </header>

      <section className="abstract-section">
        <h2>Project Abstract</h2>
        <p>
          This project focuses on creating a decentralized online lettuce store
          within the YodaMart marketplace, where users can buy and sell
          different quantities and qualities of lettuce using Yoda tokens.
          Farmers can list lettuce by unit, bundle, or bulk quantity, giving
          buyers flexible purchasing options.
        </p>
        <p>
          The store is designed to support bulk discounts, bundle deals, and
          promotional offers to create a more realistic and interactive grocery
          platform experience on Ethereum.
        </p>
      </section>

      <section className="products-section">
        <div className="section-header">
          <h2>Available Listings</h2>
          <button className="refresh-btn" onClick={loadListingsFromContract}>
            Refresh Listings
          </button>
        </div>

        <div className="product-grid">
          {products.length === 0 ? (
            <p>No lettuce listings found.</p>
          ) : (
            products.map((item) => (
              <div className="card" key={item.id}>
                <div className="card-top">
                  <span className="tag">{item.quality}</span>
                  <span className="id-tag">ID #{item.id}</span>
                </div>

                <h3>{item.category} Lettuce</h3>

                <div className="details">
                  <p>
                    <strong>Price per unit:</strong> {item.pricePerUnit} YODA
                  </p>
                  <p>
                    <strong>Available quantity:</strong> {item.quantity}
                  </p>
                  <p>
                    <strong>Seller:</strong> {item.seller.slice(0, 6)}...
                    {item.seller.slice(-4)}
                  </p>
                </div>

                <div className="buy-box">
                  <input
                    type="number"
                    min="1"
                    placeholder="Amount"
                    value={buyAmounts[item.id] || ""}
                    onChange={(e) =>
                      setBuyAmounts({
                        ...buyAmounts,
                        [item.id]: e.target.value,
                      })
                    }
                  />

                  <button
                    className="buy-btn"
                    onClick={() => buyLettuce(item.id)}
                    disabled={loading}
                  >
                    {loading ? "Processing..." : "Buy"}
                  </button>
                </div>

                <p className="deal-note">
                  Bulk orders of 10+ units may receive discounted pricing in the
                  contract.
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default App;