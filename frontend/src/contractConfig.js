export const LETTUCE_MARKET_ADDRESS = "0x2175eDA761474b38d14304Bc37ba8A445799f9f8";

export const LETTUCE_MARKET_ABI = [
  "function nextId() view returns (uint256)",
  "function getLettuce(uint256 id) view returns (tuple(uint256 id, address seller, uint256 pricePerUnit, uint256 quantity, string category, string quality))",
  "function listLettuce(uint256 pricePerUnit, uint256 quantity, string category, string quality)",
  "function buyLettuce(uint256 id, uint256 amount)",
];