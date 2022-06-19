//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "contracts/IGoldCoin.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract Chrysus is ERC20, IGoldCoin {
    
    uint256 liquidationRatio; //basis points
    uint256 collateralizationRatio; //basis points
    uint256 ethBalance;
    uint256 ethFees;

    address[] approvedTokens;

    AggregatorV3Interface oracleCHC;
    AggregatorV3Interface oracleXAU;

    address treasury;
    address swapSolution;
    address stabilityModule;

    struct Collateral {
        bool approved;
        uint256 balance;
        uint256 fees;
        AggregatorV3Interface oracle;
    }

    struct Deposit {
        uint256 amount;
        uint256 timestamp;
    }

    mapping(address=>mapping(address=>Deposit)) userDeposits; //user -> token address -> Deposit struct

    mapping(address=>Collateral) approvedCollateral;

    constructor(address _daiAddress, address _oracleDAI, address _oracleETH, address _oracleCHC, address _oracleXAU) ERC20("Chrysus", "CHC") {

        liquidationRatio = 110 * 100; //basis points

        //add Dai as approved collateral
        approvedCollateral[_daiAddress].approved = true;

        //represent eth deposits as address 0 (a placeholder)
        approvedCollateral[address(0)].approved = true;

        approvedTokens.push(_daiAddress);
        approvedTokens.push(address(0));

        //connect to oracles
        approvedCollateral[_daiAddress].oracle = AggregatorV3Interface(_oracleDAI);
        approvedCollateral[address(0)].oracle = AggregatorV3Interface(_oracleETH);

        oracleCHC = AggregatorV3Interface(_oracleCHC);
        oracleXAU = AggregatorV3Interface(_oracleXAU);

    }

    function collateralRatio() public view returns(uint256) {
        
        //get CHC price using oracle
        (, int priceCHC, , ,) = oracleCHC.latestRoundData();

        //multiply CHC price * CHC total supply
        uint256 valueCHC = uint(priceCHC) * totalSupply();

        //declare collateral sum
        uint256 totalcollateralValue;
        //declare collateral amount
        uint256 singleCollateralAmount;
        //declare usd price
        uint256 singleCollateralValue;

        //for each collateral type...
        for (uint i; i < approvedTokens.length; i++) {
            //read oracle price
            approvedCollateral[approvedTokens[i]]

            //multiply collateral amount in contract * oracle price to get USD price
            //add to sum

        }

        //divide value of CHC * 100 by value of collateral sum / 10000

    }

    function depositCollateral(address _collateralType, uint256 _amount) payable public {

        //10% of initial collateral collected as fee
        uint256 ethFee = 10 * 100 * msg.value / 10000;
        uint256 tokenFee = 10 * 100 * _amount / 10000;

        // //catch ether deposits
        // userTokenDeposits[msg.sender][address(0)].amount += msg.value - ethFee;

        //catch token deposits
        userDeposits[msg.sender][_collateralType].amount += _amount - tokenFee;

        //read CHC/USD oracle

        //read XAU/USD oracle

        //create CHC/XAU ratio

        //multiply amount minted by CHC/XAU ratio

        //update collateralization ratio

        //approve and transfer from token (if address is not address 0)

        //mint new tokens (mint _amount * CHC/XAU ratio)
        _mint();


    }
    
    function liquidate() external {

        //require collateralizaiton ratio is under liquidation ratio

        //
    }

    //withdraws collateral in exchange for a given amount of CHC tokens
    function withdrawCollateral(address _collateralType, uint256 _amount) external {

        //transfer CHC back to contract

        //convert value of CHC into value of collateral
            //multiply by CHC/USD price
            //divide by collateral to USD price

        //burn the CHC amount

        //require that the transfer to msg.sender of collat amount is successful

    }

    function _readOracle(address _feedAddress) internal {
        //use chainlink interface to read value, then parse value
    }

    
    //for depositing ETH as collateral
    receive() payable external {

        depositCollateral(address(0), msg.value);

    }

}
