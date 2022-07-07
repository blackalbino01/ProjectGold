//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "contracts/IGoldCoin.sol";
import "contracts/ISwap.sol";
import "contracts/IStabilityModule.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "contracts/AggregatorV3Interface.sol";
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

contract Chrysus is ERC20, IGoldCoin {
    
    uint256 liquidationRatio; 
    uint256 collateralizationRatio; 
    uint256 ethBalance;
    uint256 ethFees;

    address[] approvedTokens;

    AggregatorV3Interface oracleCHC;
    AggregatorV3Interface oracleXAU;

    ISwapRouter public immutable swapRouter;
    ISwap public swapSolution;
    IStabilityModule public stabilityModule;

    address governance;
    address treasury;
    address auction;

    struct Collateral {
        bool approved;
        uint256 balance;
        uint256 fees;
        AggregatorV3Interface oracle;
    }

    struct Deposit {
        uint256 deposited;
        uint256 minted;
    }

    mapping(address=>mapping(address=>Deposit)) userDeposits; //user -> token address -> Deposit struct

    mapping(address=>Collateral) approvedCollateral;

    constructor(address _daiAddress, address _oracleDAI, address _oracleETH,
                address _oracleCHC, address _oracleXAU,
                address _governance,
                ISwapRouter _swapRouter, address _swapSolution,
                address _stabilityModule)
                 ERC20("Chrysus", "CHC") {

        liquidationRatio = 110;

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

        governance = _governance;

        swapRouter = _swapRouter;

        swapSolution = ISwap(_swapSolution);
        stabilityModule = IStabilityModule(_stabilityModule);



    }

    function addCollateralType(address _collateralType) override external {

        require(msg.sender == governance, "can only be called by CGT governance");
        require(approvedCollateral[_collateralType].approved == false, "this collateral type already approved");
        
        approvedTokens.push(_collateralType);
        approvedCollateral[_collateralType].approved = true;
    
    }

    function collateralRatio() public view override returns(uint256) {
        
        //get CHC price using oracle
        (, int priceCHC, , ,) = oracleCHC.latestRoundData();

        //multiply CHC price * CHC total supply
        uint256 valueCHC = uint(priceCHC) * totalSupply();

        address collateralType;

        int collateralPrice;
        //declare collateral sum
        uint256 totalcollateralValue;
        //declare usd price
        uint256 singleCollateralValue;

        //for each collateral type...
        for (uint i; i < approvedTokens.length; i++) {

            collateralType = approvedTokens[i];
            //read oracle price
            (, collateralPrice, , ,) = approvedCollateral[collateralType].oracle.latestRoundData();

            //multiply collateral amount in contract * oracle price to get USD price
            singleCollateralValue = approvedCollateral[collateralType].balance * uint(collateralPrice);
            //add to sum
            totalcollateralValue += singleCollateralValue;

        }

        //divide value of CHC * 100 by value of collateral sum / 10000
        return valueCHC * 100 / totalcollateralValue / 1000;

    }

    function depositCollateral(address _collateralType, uint256 _amount) override payable public {

        //10% of initial collateral collected as fee
        uint256 ethFee = 10 * 100 * msg.value / 10000;
        uint256 tokenFee = 10 * 100 * _amount / 10000;

        //increase fee balance
        approvedCollateral[address(0)].fees += ethFee;

        if(_collateralType != address(0)) {
            approvedCollateral[_collateralType].fees += tokenFee;
        }
        // //catch ether deposits
        // userTokenDeposits[msg.sender][address(0)].amount += msg.value - ethFee;

        //catch token deposits
        userDeposits[msg.sender][_collateralType].deposited += _amount - tokenFee;

        //increase balance in approvedColateral mapping
        approvedCollateral[_collateralType].balance += _amount - tokenFee;


        //read CHC/USD oracle
        (, int priceCHC, , ,) = oracleCHC.latestRoundData();

        //read XAU/USD oracle
        (, int priceXAU, , ,) = oracleXAU.latestRoundData();

        //create CHC/XAU ratio
        uint256 ratio = uint(priceCHC * 100 / priceXAU / 10000);

        //read collateral price to calculate amount of CHC to mint
        (, int priceCollateral, , ,) = approvedCollateral[_collateralType].oracle.latestRoundData();
        uint256 amountToMint = (_amount - tokenFee) * uint(priceCollateral) * 100 / uint(priceCHC) / 10000;

        //divide amount minted by CHC/XAU ratio
        amountToMint = amountToMint * 100 / ratio / 10000;

        //update collateralization ratio
        collateralizationRatio = collateralRatio();

        //approve and transfer from token (if address is not address 0)
        if (_collateralType != address(0)) {
            IERC20(_collateralType).approve(address(this), _amount);
        }
        //mint new tokens (mint _amount * CHC/XAU ratio)
        _mint(msg.sender, amountToMint);

        userDeposits[msg.sender][_collateralType].minted += amountToMint;



    }
    
    function liquidate(address _collateralType) external {

        //require collateralizaiton ratio is under liquidation ratio
        require(collateralizationRatio < liquidationRatio, "cannot liquidate position");

        (, int priceCollateral, , ,) = approvedCollateral[_collateralType].oracle.latestRoundData();
        (, int priceXAU, , ,) = oracleXAU.latestRoundData();

        uint256 amountOut = userDeposits[msg.sender][_collateralType].minted * uint(priceCollateral) * 100 / uint(priceXAU) / 10000;
        uint256 amountInMaximum = userDeposits[msg.sender][_collateralType].minted;


        //sell collateral on swap solution at or above price of XAU
        uint256 amountIn = swapSolution.swapExactOutput(
            address(this),
            _collateralType,
            3000,
            msg.sender,
            block.timestamp,
            amountOut,
            amountInMaximum
        );

        //sell collateral on uniswap at or above price of XAU

        TransferHelper.safeApprove(address(this), address(swapRouter), amountInMaximum);

        amountOut = userDeposits[msg.sender][_collateralType].minted * uint(priceCollateral) * 100 / uint(priceXAU) / 10000;

        ISwapRouter.ExactOutputSingleParams memory params =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: address(this),
                tokenOut: _collateralType,
                fee: 3000,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
            });

        amountIn = swapRouter.exactOutputSingle(params);


        if (amountIn < amountInMaximum) {
            TransferHelper.safeApprove(_collateralType, address(swapRouter), 0);
            TransferHelper.safeTransfer(address(this), msg.sender, amountInMaximum - amountIn);

            amountInMaximum = amountIn;
        }
        
        //auction off the rest
        approve(auction, amountInMaximum);
        transferFrom(msg.sender, auction, amountInMaximum);
    }

    //withdraws collateral in exchange for a given amount of CHC tokens
    function withdrawCollateral(address _collateralType, uint256 _amount) override external {

        //transfer CHC back to contract
        transfer(address(this), _amount);

        //convert value of CHC into value of collateral
        //multiply by CHC/USD price
        (, int priceCHC, , ,) = oracleCHC.latestRoundData();
        (, int priceCollateral, , ,) = approvedCollateral[_collateralType].oracle.latestRoundData();
        //divide by collateral to USD price
        uint256 collateralToReturn = _amount * uint(priceCHC) * 100 / uint(priceCollateral) / 10000;

        //decrease collateral balance at user's account
        userDeposits[msg.sender][_collateralType].deposited -= _amount;

        //burn the CHC amount
        _burn(msg.sender, _amount);

        userDeposits[msg.sender][_collateralType].minted -= _amount;


        //update collateralization ratio
        collateralizationRatio = collateralRatio();

        //require that the transfer to msg.sender of collat amount is successful
        if (_collateralType == address(0)) {
            (bool success, ) = msg.sender.call{value: collateralToReturn}("");
            require(success, "return of ether collateral was unsuccessful");
        } else {
            require(IERC20(_collateralType).transfer(msg.sender, collateralToReturn));
        }
    }

    function withdrawFees() override external {

        //30% to treasury
        //20% to swap solution for liquidity
        //50% to stability module

        //iterate through collateral types

        address collateralType;

        for (uint i; i < approvedTokens.length; i++) {

            collateralType = approvedTokens[i];

            //send as ether if ether
            if (collateralType == address(0)) {
                
                (bool success, ) = treasury.call{value: approvedCollateral[collateralType].fees * 3000 / 10000}("");
                (success, ) = address(swapSolution).call{value: approvedCollateral[collateralType].fees * 2000 / 10000}("");
                (success, ) = address(stabilityModule).call{value: approvedCollateral[collateralType].fees * 5000 / 10000}("");

                approvedCollateral[collateralType].fees = 0;

            } else {
                //transfer as token if token
                transferFrom(address(this), treasury, approvedCollateral[collateralType].fees * 3000 / 10000);

                IERC20(collateralType).approve(address(swapSolution), approvedCollateral[collateralType].fees * 2000 / 10000);
                swapSolution.addLiquidity(collateralType, approvedCollateral[collateralType].fees * 2000 / 10000);

                IERC20(collateralType).approve(address(stabilityModule), approvedCollateral[collateralType].fees * 5000 / 10000);
                stabilityModule.addTokens(collateralType, approvedCollateral[collateralType].fees * 2000 / 10000);

                approvedCollateral[collateralType].fees = 0;
            }

        }
    }

    
    //for depositing ETH as collateral
    receive() payable external {

        depositCollateral(address(0), msg.value);

    }

}
