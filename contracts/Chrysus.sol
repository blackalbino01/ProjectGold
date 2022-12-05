//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "hardhat/console.sol";
import "contracts/libraries/Math.sol";
import "contracts/interfaces/ISwap.sol";
import "contracts/interfaces/IStabilityModule.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "contracts/interfaces/AggregatorV3Interface.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "contracts/interfaces/IUniswapV2Pair.sol";

import {IGovernance} from "contracts/interfaces/IGovernance.sol";

contract Chrysus is ERC20, ReentrancyGuard {

    using DSMath for uint;

    uint256 public liquidationRatio;
    uint256 public collateralizationRatio;
    
    address[] public approvedTokens;
    address public governance;
    address public treasury;
    address public auction;

    AggregatorV3Interface public oracleCHC;
    AggregatorV3Interface public oracleXAU;

    ISwapRouter public immutable swapRouter;
    ISwap public immutable swapSolution;
    IStabilityModule public  immutable stabilityModule;
    IUniswapV2Pair public pair;


    struct Collateral {
        bool approved;
        uint256 balance;
        uint256 fees;
        uint256 minCollateral;
        AggregatorV3Interface oracle;
    }

    struct Deposit {
        uint256 deposited;
        uint256 minted;
    }

    /// @notice Thrown when address zero is provided
    error ZeroAddress();

    mapping(address => mapping(address => Deposit)) public userDeposits; //user -> token address -> Deposit struct

    mapping(address => Collateral) public approvedCollateral;

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event AddedCollateralType(address indexed collateralToken);
    event Liquidated(address indexed liquidator, address indexed user, uint256 amountLiquidated);
    event FeesWithdrawn(uint256 indexed treasuryFees, uint256 indexed swapSolutionFees, uint256 indexed stabilityModuleFees);

    constructor(
        address _daiAddress,
        address _oracleDAI,
        address _oracleETH,
        address _oracleCHC,
        address _oracleXAU,
        address _governance,
        address _treasury,
        address _auction,
        address _swapRouter,
        address _swapSolution,
        address _stabilityModule
    ) ERC20("Chrysus", "CHC") {
        if (_daiAddress == address(0)) revert ZeroAddress();
        if (_oracleDAI == address(0)) revert ZeroAddress();
        if (_oracleETH == address(0)) revert ZeroAddress();
        if (_oracleXAU == address(0)) revert ZeroAddress();
        if (_governance == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        if (_auction == address(0)) revert ZeroAddress();
        if (_swapSolution == address(0)) revert ZeroAddress();
        if (_stabilityModule == address(0)) revert ZeroAddress();
        liquidationRatio = 110e6;

        _addCollateralType(_daiAddress, 267, _oracleDAI);
        _addCollateralType(address(0), 120, _oracleETH);

        oracleCHC = AggregatorV3Interface(_oracleCHC);
        oracleXAU = AggregatorV3Interface(_oracleXAU);

        governance = _governance;
        treasury = _treasury;
        auction = _auction;

        swapRouter = ISwapRouter(_swapRouter);

        swapSolution = ISwap(_swapSolution);
        stabilityModule = IStabilityModule(_stabilityModule);
    }


    //for depositing ETH as collateral
    receive() external payable {
        depositCollateral(address(0), msg.value);
    }


    function addCollateralType(
        address _collateralType,
        uint256 _minCollateral,
        address _oracleAddress
    ) external {
        require(
            msg.sender == governance,
            "can only be called by CGT governance"
        );
        require(
            approvedCollateral[_collateralType].approved == false,
            "this collateral type already approved"
        );
        _addCollateralType(_collateralType, _minCollateral, _oracleAddress);
    }


    function liquidate(address _userToliquidate, address _collateralType, uint _amount) external nonReentrant{
        
        if (_userToliquidate == address(0)) revert ZeroAddress();
        if (_collateralType == address(0)) revert ZeroAddress();
        require(_amount > 0, "amount can not be 0");
                
        require(_amount <= userDeposits[_userToliquidate][_collateralType]
            .deposited, "user has no positions to liquidate");
        _liquidate(_userToliquidate, _collateralType, _amount);
    }


    //withdraws collateral in exchange for a given amount of CHC tokens
    function withdrawCollateral(address _collateralType, uint256 _amount)
        external nonReentrant
    {
        //transfer CHC back to contract
        transfer(address(this), _amount);

        //convert value of CHC into value of collateral
        //multiply by CHC/USD price
        (, int256 priceCHC, , , ) = oracleCHC.latestRoundData();
        (, int256 priceCollateral, , , ) = approvedCollateral[_collateralType]
            .oracle
            .latestRoundData();
        //divide by collateral to USD price
        uint256 collateralToReturn = DSMath.div(_amount * uint256(priceCollateral),
            uint256(priceCHC));

        //decrease collateral balance at user's account
        userDeposits[msg.sender][_collateralType].deposited -= _amount;

        userDeposits[msg.sender][_collateralType].minted -= collateralToReturn;

        //burn the CHC amount
        _burn(address(this), _amount);


        //update collateralization ratio
        collateralizationRatio = getCollateralizationRatio();

        //require that the transfer to msg.sender of collat amount is successful
        if (_collateralType == address(0)) {
            (bool success, ) = msg.sender.call{value: collateralToReturn}("");
            require(success, "return of ether collateral was unsuccessful");
        } else {
            require(
                IERC20(_collateralType).transfer(msg.sender, collateralToReturn)
            );
        }

        emit CollateralWithdrawn(msg.sender, _amount);
    }

    // slither-disable-next-line arbitrary-send
    function withdrawFees() external {
        //30% to treasury
        //20% to swap solution for liquidity
        //50% to stability module

        //iterate through collateral types

        address team = IGovernance(governance).team();

        require(msg.sender == team);
        address collateralType;

        for (uint256 i = 0; i < approvedTokens.length; i++) {
            collateralType = approvedTokens[i];

            uint256 _fees = approvedCollateral[collateralType].fees;

            approvedCollateral[collateralType].fees = 0;

            //send as ether if ether
            if (collateralType == address(0)) {
                (bool success, ) = treasury.call{
                    value: DSMath.wdiv(DSMath.wmul(_fees, 3000), 
                        10000)
                }("");
                require(success);
                (success, ) = address(swapSolution).call{
                    value: DSMath.div(_fees, 5)
                }("");

                (success, ) = address(stabilityModule).call{
                    value: DSMath.wdiv(DSMath.wmul(_fees, 5000), 
                        10000)
                }("");

                emit FeesWithdrawn(DSMath.wdiv(DSMath.wmul(_fees, 3000), 
                        10000), 
                        DSMath.div(_fees, 5), 
                        DSMath.wdiv(DSMath.wmul(_fees, 5000), 
                        10000)
                );


            } else {

                //transfer as token if token
                bool success = IERC20(collateralType).transfer(
                    treasury,
                    DSMath.wdiv(DSMath.wmul(_fees, 3000), 
                        10000)
                );
                require(success);

                success = IERC20(collateralType).approve(
                    address(swapSolution),
                    DSMath.wdiv(DSMath.wmul(_fees, 2000), 
                        10000)
                );
                require(success);
                address _pair = swapSolution.getPair(collateralType, address(this));
                uint256 amount = DSMath.div(_fees , 5);


                IERC20(collateralType).approve(_pair, amount);
                IERC20(collateralType).transferFrom(address(this), _pair, amount);

                success = IERC20(collateralType).transfer(
                    address(stabilityModule),
                    DSMath.div(_fees, 2)
                );

                emit FeesWithdrawn(DSMath.wdiv(DSMath.wmul(_fees, 3000), 
                        10000), 
                        DSMath.div(_fees, 5), 
                        DSMath.div(_fees, 2)
                );
            }
        }

    }


    function getCollateralizationRatio() public view returns (uint256) {
        //get CHC price using oracle
        (, int256 priceCHC, , , ) = oracleCHC.latestRoundData();

        //multiply CHC price * CHC total supply
        uint256 valueCHC = uint256(priceCHC) * totalSupply();

        if (valueCHC == 0) {
            return 110e6;
        }

        address collateralType;

        int256 collateralPrice;
        //declare collateral sum
        uint256 totalcollateralValue;
        //declare usd price
        uint256 singleCollateralValue;

        //for each collateral type...
        for (uint256 i = 0; i < approvedTokens.length; i++) {
            collateralType = approvedTokens[i];
            //read oracle price
            (, collateralPrice, , , ) = approvedCollateral[collateralType]
                .oracle
                .latestRoundData();

            //multiply collateral amount in contract * oracle price to get USD price
            singleCollateralValue =
                approvedCollateral[collateralType].balance *
                uint256(collateralPrice);
            //add to sum
            totalcollateralValue += singleCollateralValue;
        }

        

        return DSMath.div(DSMath.mul(totalcollateralValue, 1 ether), valueCHC);
    }

    // slither-disable-next-line divide-before-multiply reentrancy-no-eth
    function depositCollateral(address _collateralType, uint256 _amount)
        public
        payable
    {
        //10% of initial collateral collected as fee
        uint256 ethFee = DSMath.div(msg.value, 10);
        uint256 tokenFee = DSMath.div(_amount, 10);

        //increase fee balance

        _collateralType != address(0) ? approvedCollateral[_collateralType].fees += tokenFee : approvedCollateral[address(0)].fees += ethFee;

        //catch token deposits
        userDeposits[msg.sender][_collateralType].deposited +=
            _amount -
            tokenFee;

        //increase balance in approvedColateral mapping
        approvedCollateral[_collateralType].balance += _amount - tokenFee;

        //read CHC/USD oracle
        (, int256 priceCHC, , , ) = oracleCHC.latestRoundData();

        //read XAU/USD oracle
        (, int256 priceXAU, , , ) = oracleXAU.latestRoundData();

        //create CHC/XAU ratio
        uint256 ratio = DSMath.div(uint256(priceCHC), uint256(priceXAU));

        //read collateral price to calculate amount of CHC to mint
        (, int256 priceCollateral, , , ) = approvedCollateral[_collateralType]
            .oracle
            .latestRoundData();
        uint256 amountToMint = DSMath.wdiv(
            (_amount - tokenFee) * uint256(priceCollateral),
            uint256(priceCHC)
        );

        //divide amount minted by CHC/XAU ratio
        amountToMint = DSMath.div(
            amountToMint * 10000,
            ratio * approvedCollateral[_collateralType].minCollateral
        );

        //update collateralization ratio
        collateralizationRatio = getCollateralizationRatio();

        userDeposits[msg.sender][_collateralType].minted += amountToMint;

        //mint new tokens (mint _amount * CHC/XAU ratio)
        _mint(msg.sender, amountToMint);


        //approve and transfer from token (if address is not address 0)
        if (_collateralType != address(0)) {
            bool success = IERC20(_collateralType).transferFrom(
                msg.sender,
                address(this),
                _amount
            );
            require(success);

            emit CollateralDeposited(msg.sender, _amount);
        }

        emit CollateralDeposited(msg.sender, msg.value);
    }


    function _addCollateralType(
        address _collateralType,
        uint256 _minCollateral,
        address _oracleAddress
    ) internal {
        approvedTokens.push(_collateralType);
        approvedCollateral[_collateralType].approved = true;
        approvedCollateral[_collateralType]
            .minCollateral = _minCollateral;
        approvedCollateral[_collateralType].oracle = AggregatorV3Interface(
            _oracleAddress
        );

        emit AddedCollateralType(_collateralType);
    }

    function _liquidate(address _userToliquidate, address _collateralType, uint _amount) internal {
        //require collateralization ratio is under liquidation ratio

        collateralizationRatio = getCollateralizationRatio();
        
        require(
            collateralizationRatio < liquidationRatio,
            "cannot liquidate position"
        );

        (, int256 priceCollateral, , , ) = approvedCollateral[_collateralType]
            .oracle
            .latestRoundData();
        (, int256 priceXAU, , , ) = oracleXAU.latestRoundData();

        uint256 amountOutCHC = userDeposits[_userToliquidate][_collateralType].minted;

        require(amountOutCHC > 0, "user has no positions to liquidate");

        //sell collateral on swap solution at or above price of XAU
        address pool = swapSolution.getPair(address(this), _collateralType);

        
        require(swapSolution.uniswapV2Call(pool, 0, _amount, ""));
        userDeposits[_userToliquidate][_collateralType].minted -= amountOutCHC;
        // sell collateral on uniswap at or above price of XAU

        TransferHelper.safeApprove(
            address(this),
            address(swapRouter),
            _amount
        );

        amountOutCHC =
            (userDeposits[_userToliquidate][_collateralType].minted *
                uint256(priceCollateral) *
                100) /
            uint256(priceXAU) /
            10000;

        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter
            .ExactOutputSingleParams({
                tokenIn: address(this),
                tokenOut: _collateralType,
                fee: 3000,
                recipient: _userToliquidate,
                deadline: block.timestamp,
                amountOut: amountOutCHC,
                amountInMaximum: _amount,
                sqrtPriceLimitX96: 0
            });

        uint256 amountIn = swapRouter.exactOutputSingle(params);

        if (amountIn < _amount) {
            TransferHelper.safeApprove(_collateralType, address(swapRouter), 0);
            TransferHelper.safeTransfer(
                address(this),
                _userToliquidate,
                _amount - amountIn
            );

            _amount = amountIn;
        }

        userDeposits[_userToliquidate][_collateralType].minted -= _amount;

        uint256 remainingBalance = userDeposits[_userToliquidate][_collateralType].minted;

        if (remainingBalance > 0) {
        //auction off the rest
        approve(auction, remainingBalance);
        transferFrom(_userToliquidate, auction, remainingBalance);
        }

        userDeposits[_userToliquidate][_collateralType].minted = 0;

        emit Liquidated(pool, _userToliquidate, _amount);

    }
}
