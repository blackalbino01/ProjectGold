//SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

interface IUniswapV2Pair {

    // function approve(address spender, uint value) external returns (bool);
    // function transfer(address to, uint value) external returns (bool);
    // function transferFrom(address from, address to, uint value) external returns (bool);

    // function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external;


    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);

    // function mint(address to) external returns (uint liquidity);
    // function burn(address to) external returns (uint amount0, uint amount1);
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
    function skim(address to) external;
    function sync() external;

    function initialize(address, address) external;
}