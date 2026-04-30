// ──────────────────────────────────────────────────────────────
//  Static addresses
// ──────────────────────────────────────────────────────────────

/** YODA ERC-20 token — already deployed on Sepolia. Do NOT redeploy. */
export const YODA_TOKEN_ADDRESS =
  import.meta.env.VITE_YODA_TOKEN_ADDRESS ||
  "0xbd27d0b7F9fedb5A2A2C3ceF5dC9c70f3CF64Af2";

// LettuceMarket address is managed at runtime via:
//   1. localStorage  ("lettuce_market_address")        ← set by browser deploy
//   2. VITE_LETTUCE_MARKET_ADDRESS env var             ← optional pre-set
// App.jsx reads both; see initMarketAddress() there.

// ──────────────────────────────────────────────────────────────
//  YODA ERC-20 ABI  (2 decimals)
// ──────────────────────────────────────────────────────────────
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

// ──────────────────────────────────────────────────────────────
//  LettuceMarket ABI
// ──────────────────────────────────────────────────────────────
export const LETTUCE_MARKET_ABI = [
  // ── views ────────────────────────────────────────────────
  "function yodaToken() view returns (address)",
  "function marketOwner() view returns (address)",

  // listings
  "function nextId() view returns (uint256)",
  "function getLettuce(uint256 id) view returns (tuple(uint256 id, address seller, uint256 pricePerUnit, uint256 quantity, string category, string quality))",
  "function lettuces(uint256) view returns (uint256 id, address seller, uint256 pricePerUnit, uint256 quantity, string category, string quality)",

  // auctions
  "function nextAuctionId() view returns (uint256)",
  "function getAuction(uint256 auctionId) view returns (tuple(uint256 id, address seller, string category, string quality, uint256 quantity, uint256 startingBid, uint256 highestBid, address highestBidder, uint256 endTime, bool finalized))",
  "function auctions(uint256) view returns (uint256 id, address seller, string category, string quality, uint256 quantity, uint256 startingBid, uint256 highestBid, address highestBidder, uint256 endTime, bool finalized)",
  "function pendingReturns(uint256 auctionId, address bidder) view returns (uint256)",
  "function isAuctionActive(uint256 auctionId) view returns (bool)",

  // promotions
  "function promotionFeePerDay() view returns (uint256)",
  "function totalPromotions() view returns (uint256)",
  "function promotions(uint256) view returns (bool isAuction, uint256 listingId, address seller, uint256 feePaid, uint256 expiresAt)",
  "function getActivePromotions() view returns (tuple(bool isAuction, uint256 listingId, address seller, uint256 feePaid, uint256 expiresAt)[])",

  // ── writes ───────────────────────────────────────────────
  "function listLettuce(uint256 pricePerUnit, uint256 quantity, string category, string quality)",
  "function buyLettuce(uint256 id, uint256 amount)",
  "function listLettuceAuction(uint256 quantity, uint256 startingBid, uint256 durationDays, string category, string quality)",
  "function placeBid(uint256 auctionId, uint256 bidAmount)",
  "function withdrawOutbidTokens(uint256 auctionId)",
  "function finalizeAuction(uint256 auctionId)",
  "function setPromotionFeePerDay(uint256 newFee)",
  "function promoteListing(uint256 listingId, uint256 durationDays)",
  "function promoteAuction(uint256 auctionId, uint256 durationDays)",

  // ── events ───────────────────────────────────────────────
  "event LettuceListed(uint256 id, address seller, uint256 price, uint256 quantity)",
  "event LettucePurchased(uint256 id, address buyer, uint256 amount)",
  "event AuctionCreated(uint256 indexed auctionId, address indexed seller, uint256 quantity, uint256 startingBid, uint256 endTime)",
  "event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount)",
  "event AuctionFinalized(uint256 indexed auctionId, address indexed winner, uint256 winningBid)",
  "event BidWithdrawn(uint256 indexed auctionId, address indexed bidder, uint256 amount)",
  "event PromotionAdded(uint256 indexed promotionIndex, bool indexed isAuction, uint256 indexed listingId, address seller, uint256 feePaid, uint256 expiresAt)",
  "event PromotionFeeUpdated(uint256 newFeePerDay)",
];
