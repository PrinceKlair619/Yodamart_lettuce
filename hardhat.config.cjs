require("@nomicfoundation/hardhat-toolbox");

// Compile-only config — no RPC URL or private key required.
// Deployment is done from the browser via MetaMask.

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources:   "./contracts",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
