//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './interfaces/ISwapFactory.sol';
import './Pair.sol';

contract Swap is ISwapFactory {
    address public override feeTo;
    address public override feeToSetter;

    mapping(address => mapping(address => address)) public override getPair;
    address[] public override allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    //check that the address passed is feeSetter. 
    modifier isFeeSetter(address _address) {
        require(msg.sender == _address, 'Swap: FORBIDDEN');
        _;
    }

    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }

    function allPairsLength() external view override returns (uint) {
        return allPairs.length;
    }
    
    // slither-disable-next-line reentrancy-no-eth
    function createPair(address tokenA, address tokenB) external override isFeeSetter(msg.sender) returns (address pair) {
        require(tokenA != tokenB, 'Swap: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'Swap: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'Swap: PAIR_EXISTS'); // single check is sufficient
        bytes memory bytecode = type(Pair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        IUniswapV2Pair(pair).initialize(token0, token1);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external override isFeeSetter(_feeTo){
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external override isFeeSetter(_feeToSetter){
        feeToSetter = _feeToSetter;
    }
}