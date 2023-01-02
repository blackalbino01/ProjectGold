const { EtherscanProvider } = require("@ethersproject/providers");
const { expect, assert } = require("chai");
const { AbiCoder, defaultAbiCoder } = require("ethers/lib/utils");
const { ethers } = require("hardhat");

describe("Chrysus tests", function () {

  const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
  const DAI_FEED = "0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9"
  const ETH_FEED = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419"
  const GOLD_FEED = "0x214ed9da11d2fbe465a6fc601a91e62ebec1a0d6"
  const UNI_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564"
  const DAI_HOLDER = "0x6262998ced04146fa42253a5c0af90ca02dfd2a3"
  const UNI_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984"


  let chrysus, mockOracle, swap, mockStabilityModule, governance, mockLending, pair
  let dai
  let accounts
  let treasury, auction
  let daiHolder
  let uniFactory
  let liquidatorRatio = 1

  beforeEach(async function () {

    accounts = await ethers.getSigners()
    team = accounts[1]
    treasury = accounts[2]
    auction = accounts[3]
  
    const Governance = await hre.ethers.getContractFactory("Governance")
    governance = await Governance.deploy(
      team.address
    )
    await governance.deployed()
  
    const MockLending = await hre.ethers.getContractFactory("MockLending")
    mockLending = await MockLending.deploy(
      governance.address
    )
    await mockLending.deployed()
  
    const Swap = await hre.ethers.getContractFactory("Swap")
    swap = await Swap.deploy(governance.address)
    await swap.deployed()
  
    const MockStabilityModule = await hre.ethers.getContractFactory("MockStabilityModule")
    mockStabilityModule = await MockStabilityModule.deploy(
      governance.address
    )
    await mockStabilityModule.deployed()
  
    const MockOracle = await hre.ethers.getContractFactory("MockOracle")
    mockOracle = await MockOracle.deploy()
    await mockOracle.deployed()
  
    // We get the contract to deploy
    const Chrysus = await hre.ethers.getContractFactory("Chrysus");
    chrysus = await Chrysus.deploy(
      [DAI, //dai on rinkeby
      DAI_FEED, //dai/usd feed on rinkeby
      ETH_FEED, //eth/usd feed on rinkeby
      mockOracle.address, //chc/usd signer
      GOLD_FEED, //xau/usd feed on rinkeby
      governance.address, //governance signer
      treasury.address,
      auction.address,
      UNI_ROUTER, //uniswap router on rinkeby (same on mainnet),
      swap.address,
      mockStabilityModule.address], // stability module
      liquidatorRatio
  
    );
  
    await chrysus.deployed();

    await governance.connect(team).approve(mockStabilityModule.address, BigInt(73E24))

    await mockStabilityModule.connect(team).stake(BigInt(73E24))
  
    await governance.connect(team).init(
      chrysus.address,
      swap.address,
      mockLending.address,
      mockStabilityModule.address
    )


  //deploy dai/chc pair

  let encoder = defaultAbiCoder

  let data = encoder.encode(["address", "address"], [DAI, chrysus.address])

  await network.provider.send("evm_increaseTime", [86400*31])
  await network.provider.send("evm_mine") // this one will have 02:00 PM as its timestamp

  await governance.connect(team).proposeVote(swap.address, "0xc9c65396", data)

  await governance.connect(team).vote(1, 1, 0) //votes yes!

  await network.provider.send("evm_increaseTime", [86400*2])

  await governance.connect(team).executeVote(1)

  let pairAddress = await swap.getPair(DAI, chrysus.address)
  pair = await ethers.getContractAt("Pair", pairAddress)

  //deploy uniswap pool

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

  uniFactory = await ethers.getContractAt(
    "contracts/interfaces/IUniswapV3Factory.sol:IUniswapV3Factory",
    UNI_FACTORY
  )
  })

  it("liquidate", async function () {

    //add liquidity to swap solution
    const POOL_CHC_DAI = await uniFactory.callStatic.createPool(chrysus.address, DAI, 3000)
    await uniFactory.connect(daiHolder).createPool(chrysus.address, DAI, 3000)

    await mockOracle.setValue(BigInt(1769E18))

    let bigDaiHolder2 = await ethers.getImpersonatedSigner("0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8");
    await dai.connect(bigDaiHolder2).approve(pair.address, BigInt(1E20))
    await dai.connect(bigDaiHolder2).transferFrom("0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8", pair.address, BigInt(1E20))

    await dai.connect(bigDaiHolder2).approve(chrysus.address, BigInt(1E24))
    await chrysus.connect(bigDaiHolder2).depositCollateral(DAI, BigInt(1E24))

    await dai.connect(daiHolder).approve(pair.address, BigInt(1E20))
    await dai.connect(daiHolder).transferFrom(DAI_HOLDER, pair.address, BigInt(1E21))

    await dai.connect(daiHolder).approve(chrysus.address, BigInt(5E22))
    await chrysus.connect(daiHolder).depositCollateral(DAI, BigInt(5E22))

    let balance = await chrysus.balanceOf("0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8")

    console.log("balance", balance / Number(1E18))

    await chrysus.connect(bigDaiHolder2).transfer(POOL_CHC_DAI, balance)

    balance = await chrysus.balanceOf(DAI_HOLDER)

    // await chrysus.connect(daiHolder).transfer(POOL_CHC_DAI, BigInt(balance / 2))
    await dai.connect(daiHolder).transfer(POOL_CHC_DAI, BigInt(balance / 2))

    await chrysus.connect(daiHolder).transfer(pair.address, BigInt(balance / 2))
    await dai.connect(daiHolder).transfer(pair.address, BigInt(balance / 2))

    await dai.connect(daiHolder).transfer(team.address, BigInt(3E22))

    await dai.connect(team).approve(chrysus.address, BigInt(3E22))
    await chrysus.connect(team).depositCollateral(DAI, BigInt(3E22))

    let bal = await chrysus.balanceOf(team.address)
    await chrysus.connect(team).transfer(pair.address, bal)

    await pair.connect(team).mint(team.address)

    await dai.connect(daiHolder).transfer(pair.address, BigInt(1E21))

    await mockOracle.setValue(BigInt(1769E18))

    // await dai.connect(daiHolder).approve(chrysus.address, userDeposit)

    // await chrysus.connect(daiHolder).depositCollateral(DAI, userDeposit)

    await mockOracle.setValue(BigInt(1E25))

    await chrysus.connect(daiHolder).approve(chrysus.address, BigInt(1E18))
    await chrysus.connect(daiHolder).liquidate(DAI_HOLDER,DAI, BigInt(1E18))
    

  }),

  it("depositCollateral", async function () {

    await mockOracle.setValue(BigInt(1769E18))

    let userDeposit = BigInt(1769E18)

    await dai.connect(daiHolder).approve(chrysus.address, userDeposit)

    await chrysus.connect(daiHolder).depositCollateral(DAI, userDeposit)

    let collectedFee = (await chrysus.approvedCollateral(DAI))[2]

    expect(collectedFee).to.equal(userDeposit / BigInt(10))

    let amountMinted = Number(await chrysus.balanceOf(DAI_HOLDER))

    expect(amountMinted * Number(2.67) / Number(1E18)).to.be.closeTo(0.9, 0.01)
    
    let collateralRatio = await chrysus.getCollateralizationRatio()

    assert(collateralRatio >= Number(110E6))
  })

  it("moving collat ratio", async function () {

    let originalCollateralRatio = await chrysus.getCollateralizationRatio()

    await mockOracle.setValue(BigInt(1769E18))

    let userDeposit = BigInt(1769E18)

    await dai.connect(daiHolder).approve(chrysus.address, userDeposit)

    await chrysus.connect(daiHolder).depositCollateral(DAI, userDeposit)

    let afterDepositeCollateralRatio = chrysus.getCollateralizationRatio()

    let amountMinted = await chrysus.balanceOf(DAI_HOLDER)
    await chrysus.connect(daiHolder).withdrawCollateral(DAI, BigInt(amountMinted))
    let afterWithdrawalcollateralRatio = await chrysus.getCollateralizationRatio()

    expect(originalCollateralRatio).to.equal(afterWithdrawalcollateralRatio)

    expect(afterDepositeCollateralRatio > originalCollateralRatio)



  })

  it("withdrawCollateral", async function () {

    await mockOracle.setValue(BigInt(1769E18))
    let userDeposit = BigInt(1769E18)
    await dai.connect(daiHolder).approve(chrysus.address, userDeposit)
    await chrysus.connect(daiHolder).depositCollateral(DAI, userDeposit)
    let amountMinted = await chrysus.balanceOf(DAI_HOLDER)

    await chrysus.connect(daiHolder).withdrawCollateral(DAI, BigInt(amountMinted))

    let collateralRatio = await chrysus.getCollateralizationRatio()

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

    await chrysus.connect(team).withdrawFees()

  })

  it("vote", async function() {

  })

  it("mints set amount daily", async function() {

  })
})
