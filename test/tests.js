const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Chrysus tests", function () {

  const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
  const DAI_FEED = "0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9"
  const ETH_FEED = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419"
  const GOLD_FEED = "0x214ed9da11d2fbe465a6fc601a91e62ebec1a0d6"


  let chrysus;

  beforeEach(async function () {
		accounts = await ethers.getSigners();
		const Chrysus = await ethers.getContractFactory("Chrysus");
		chrysus = await TellorFlex.deploy(token.address, accounts[0].address, STAKE_AMOUNT, REPORTING_LOCK);
		await chrysus.deployed();
		await token.mint(accounts[1].address, web3.utils.toWei("1000"));
        await token.connect(accounts[1]).approve(tellor.address, web3.utils.toWei("1000"))
	});

  it("Should return the new greeting once it's changed", async function () {
    const Greeter = await ethers.getContractFactory("Greeter");
    const greeter = await Greeter.deploy("Hello, world!");
    await greeter.deployed();

    expect(await greeter.greet()).to.equal("Hello, world!");

    const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

    // wait until the transaction is mined
    await setGreetingTx.wait();

    expect(await greeter.greet()).to.equal("Hola, mundo!");
  });
});
