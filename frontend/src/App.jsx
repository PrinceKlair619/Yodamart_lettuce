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
  const [products, setProducts] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);

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
      setStatus("Loading listings from contract...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        LETTUCE_MARKET_ADDRESS,
        LETTUCE_MARKET_ABI,
        provider
      );

      const totalListings = await contract.nextId();
      const loadedListings = [];

      for (let i = 0; i < Number(totalListings); i++) {
        const item = await contract.getLettuce(i);

        const quantity = Number(item.quantity);

        if (quantity > 0) {
          loadedListings.push({
            id: Number(item.id),
            seller: item.seller,
            pricePerUnit: item.pricePerUnit.toString(),
            quantity: item.quantity.toString(),
            category: item.category,
            quality: item.quality,
          });
        }
      }

      setProducts(loadedListings);

      if (loadedListings.length === 0) {
        setStatus("No listings found on contract");
      } else {
        setStatus("Listings loaded from contract");
      }
    } catch (error) {
      console.error(error);
      setStatus("Failed to load listings from contract");
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

          <button
            className="refresh-btn"
            onClick={loadListingsFromContract}
            style={{ marginTop: "10px" }}
          >
            Refresh Listings
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
        </div>

        {loadingListings ? (
          <p>Loading listings...</p>
        ) : products.length === 0 ? (
          <p>No listings to display.</p>
        ) : (
          <div className="product-grid">
            {products.map((item) => (
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

                <p className="deal-note">
                  Bulk orders of 10+ units may receive discounted pricing in the
                  contract.
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default App;