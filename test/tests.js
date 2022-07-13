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


  let chrysus, mockOracle, mockSwap, mockStabilityModule
  let dai
  let accounts
  let governance, treasury, auction
  let daiHolder

  beforeEach(async function () {

    accounts = await ethers.getSigners()
    governance = accounts[1]
    treasury = accounts[2]
    auction = accounts[3]

    const MockStabilityModule = await hre.ethers.getContractFactory("MockStabilityModule")
    mockStabilityModule = await MockStabilityModule.deploy()
    await mockStabilityModule.deployed()
    console.log("mockStabilityModule: ", mockStabilityModule.address)


    const MockSwap = await hre.ethers.getContractFactory("MockSwap")
    mockSwap = await MockSwap.deploy()
    await mockSwap.deployed()
    console.log("mockSwap: ", mockSwap.address)

    const MockOracle = await hre.ethers.getContractFactory("MockOracle")
    mockOracle = await MockOracle.deploy()
    await mockOracle.deployed()
    console.log("mockOracle: ", mockOracle.address)

    // We get the contract to deploy
    const Chrysus = await hre.ethers.getContractFactory("Chrysus");
    chrysus = await Chrysus.deploy(
      DAI, //dai on mainnet
      DAI_FEED, //dai/usd feed on mainnet
      ETH_FEED, //eth/usd feed on mainnet
      mockOracle.address, //chc/usd signer
      GOLD_FEED, //xau/usd feed on mainnet
      governance.address, //governance signer
      treasury.address,
      auction.address,
      UNI_ROUTER, //uniswap router on mainnet (same on rinkeby),
      mockSwap.address,
      mockStabilityModule.address // stability module

  );

  await chrysus.deployed();

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

    let userDeposit = BigInt(1742E18)

    await mockOracle.setValue(BigInt(1742E18))

    await dai.connect(daiHolder).approve(chrysus.address, userDeposit)

    await chrysus.connect(daiHolder).depositCollateral(DAI, userDeposit)

    await mockOracle.setValue(BigInt(1E25))

    await chrysus.liquidate(DAI)
    

  });

  it("depositCollateral", async function () {

    await mockOracle.setValue(BigInt(1742E18))

    let userDeposit = BigInt(1742E18)

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

    await mockOracle.setValue(BigInt(1742E18))
    let userDeposit = BigInt(1742E18)
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

    await mockOracle.setValue(BigInt(1742E18))
    let userDeposit = BigInt(1742E18)
    await dai.connect(daiHolder).approve(chrysus.address, userDeposit)
    await chrysus.connect(daiHolder).depositCollateral(DAI, userDeposit)
    let amountMinted = await chrysus.balanceOf(DAI_HOLDER)

    let fees = (await chrysus.approvedCollateral(DAI))['fees']

    expect(fees).to.be.equal(userDeposit / BigInt(10))

    await chrysus.withdrawFees()

  })
});
