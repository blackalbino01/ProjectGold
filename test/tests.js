const { EtherscanProvider } = require("@ethersproject/providers");
const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

describe("Chrysus tests", function () {

  const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
  const DAI_FEED = "0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9"
  const ETH_FEED = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419"
  const GOLD_FEED = "0x214ed9da11d2fbe465a6fc601a91e62ebec1a0d6"
  const UNI_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564"
  const DAI_HOLDER = "0x6262998ced04146fa42253a5c0af90ca02dfd2a3"


  let chrysus, mockOracle, swap, mockStabilityModule, governance, mockLending
  let dai
  let accounts
  let treasury, auction
  let daiHolder

  beforeEach(async function () {

    accounts = await ethers.getSigners()
    console.log(accounts[0].address)
    team = accounts[1]
    treasury = accounts[2]
    auction = accounts[3]
  
    const Governance = await hre.ethers.getContractFactory("Governance")
    governance = await Governance.deploy(
      team.address
    )
    await governance.deployed()
    console.log("governance ", governance.address)
    console.log("team ", team.address)
  
    const MockLending = await hre.ethers.getContractFactory("MockLending")
    mockLending = await MockLending.deploy(
      governance.address
    )
    await mockLending.deployed()
    console.log("lending ", mockLending.address)
  
    const Swap = await hre.ethers.getContractFactory("Swap")
    swap = await Swap.deploy(governance.address)
    await swap.deployed()
    console.log("swap solution: ", swap.address)
  
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
    mockOracle = await MockOracle.deploy()
    await mockOracle.deployed()
    console.log("mockOracle: ", mockOracle.address)
  
    // We get the contract to deploy
    const Chrysus = await hre.ethers.getContractFactory("Chrysus");
    chrysus = await Chrysus.deploy(
      DAI, //dai on rinkeby
      DAI_FEED, //dai/usd feed on rinkeby
      ETH_FEED, //eth/usd feed on rinkeby
      mockOracle.address, //chc/usd signer
      GOLD_FEED, //xau/usd feed on rinkeby
      governance.address, //governance signer
      treasury.address,
      auction.address,
      UNI_ROUTER, //uniswap router on rinkeby (same on mainnet),
      swap.address,
      mockStabilityModule.address // stability module
  
    );
  
    await chrysus.deployed();
  
    await governance.connect(team).init(
      chrysus.address,
      swap.address,
      mockLending.address
    )
  
    console.log("Chrysus Stablecoin deployed to:", chrysus.address);
    console.log("chc/usd feed signer", accounts[0].address)

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [DAI_HOLDER],
  });

  daiHolder = await ethers.provider.getSigner(
    DAI_HOLDER
  );

  dai = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    DAI
  )

	});

  it("liquidate", async function () {

    let userDeposit = BigInt(1769E18)

    await mockOracle.setValue(BigInt(1769E18))

    await dai.connect(daiHolder).approve(chrysus.address, userDeposit)

    await chrysus.connect(daiHolder).depositCollateral(DAI, userDeposit)

    await mockOracle.setValue(BigInt(1E25))

    await chrysus.liquidate(DAI)
    

  });

  it("depositCollateral", async function () {

    await mockOracle.setValue(BigInt(1769E18))

    let userDeposit = BigInt(1769E18)

    await dai.connect(daiHolder).approve(chrysus.address, userDeposit)

    await chrysus.connect(daiHolder).depositCollateral(DAI, userDeposit)

    let collectedFee = (await chrysus.approvedCollateral(DAI))[2]

    expect(collectedFee).to.equal(userDeposit / BigInt(10))

    let amountMinted = Number(await chrysus.balanceOf(DAI_HOLDER))

    expect(amountMinted * Number(2.67) / Number(1E18)).to.be.closeTo(0.9, 0.01)
    
    let collateralRatio = await chrysus.collateralRatio()

    assert(collateralRatio >= Number(110E6))
  })

  it("withdrawCollateral", async function () {

    await mockOracle.setValue(BigInt(1769E18))
    let userDeposit = BigInt(1769E18)
    await dai.connect(daiHolder).approve(chrysus.address, userDeposit)
    await chrysus.connect(daiHolder).depositCollateral(DAI, userDeposit)
    let amountMinted = await chrysus.balanceOf(DAI_HOLDER)

    await chrysus.connect(daiHolder).withdrawCollateral(DAI, BigInt(amountMinted))

    let collateralRatio = await chrysus.collateralRatio()

    assert(collateralRatio >= Number(110E6))

    let finalBalance = Number(await chrysus.balanceOf(DAI_HOLDER))

    expect(finalBalance).to.be.eq(0)

  })

  it("withdrawFees", async function () {

    await mockOracle.setValue(BigInt(1769E18))
    let userDeposit = BigInt(1769E18)
    await dai.connect(daiHolder).approve(chrysus.address, userDeposit)
    await chrysus.connect(daiHolder).depositCollateral(DAI, userDeposit)
    let amountMinted = await chrysus.balanceOf(DAI_HOLDER)

    let fees = (await chrysus.approvedCollateral(DAI))['fees']

    expect(fees).to.be.equal(userDeposit / BigInt(10))

    await chrysus.withdrawFees()

  })

  it("vote", async function() {

  })

  it("mints set amount daily", async function() {

  })
});
