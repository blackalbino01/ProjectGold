//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface ISwap {
    function addLiquidity(address _collateralType, uint256 _amount)
        external
        payable;

    function swapExactOutput(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        address recipient,
        uint256 deadline,
        uint256 amountOut,
        uint256 amountInMaximum
    ) external returns (uint256);

    function getPair(address tokenA, address tokenB) external view returns (address pair);


    function uniswapV2Call(address sender, uint amount0, uint amount1, bytes memory data) external returns (bool);

}
