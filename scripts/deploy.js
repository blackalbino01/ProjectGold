// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers } = require("hardhat");
const hre = require("hardhat");

async function main() {

  let accounts = await ethers.getSigners()
  team = accounts[1]
  treasury = accounts[2]
  auction = accounts[3]

  const Governance = await hre.ethers.getContractFactory("Governance")
  governance = await Governance.deploy(
    team.address
  )
  await governance.deployed()

  const MockLending = await hre.ethers.getContractFactory("MockLending")
  let mockLending = await MockLending.deploy(
    governance.address
  )
  await mockLending.deployed()

  const MockSwap = await hre.ethers.getContractFactory("MockSwap")
  let mockSwap = await MockSwap.deploy()
  await mockSwap.deployed()
  console.log("mockSwap: ", mockSwap.address)

  console.log("gov ", governance.address)
  console.log("treasury ", treasury.address)
  console.log("auction ", auction.address)

  const MockStabilityModule = await hre.ethers.getContractFactory("MockStabilityModule")
  mockStabilityModule = await MockStabilityModule.deploy(
    governance.address
  )
  await mockStabilityModule.deployed()
  console.log("mockStabilityModule: ", mockStabilityModule.address)

  const MockOracle = await hre.ethers.getContractFactory("MockOracle")
  let mockOracle = await MockOracle.deploy()
  await mockOracle.deployed()
  console.log("mockOracle: ", mockOracle.address)

  // We get the contract to deploy
  const Chrysus = await hre.ethers.getContractFactory("Chrysus");
  let chrysus = await Chrysus.deploy(
    "0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa", //dai on rinkeby
    "0x2bA49Aaa16E6afD2a993473cfB70Fa8559B523cF", //dai/usd feed on rinkeby
    "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e", //eth/usd feed on rinkeby
    mockOracle.address, //chc/usd signer
    "0x81570059A0cb83888f1459Ec66Aad1Ac16730243", //xau/usd feed on rinkeby
    governance.address, //governance signer
    treasury.address,
    auction.address,
    "0xE592427A0AEce92De3Edee1F18E0157C05861564", //uniswap router on rinkeby (same on mainnet),
    mockSwap.address,
    mockStabilityModule.address // stability module

  );

  await chrysus.deployed();

  await governance.connect(team).init(
    chrysus.address,
    mockSwap.address,
    mockLending.address
  )

  console.log("Chrysus Stablecoin deployed to:", chrysus.address);
  console.log("chc/usd feed signer", accounts[0].address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
