pragma solidity ^0.8.0;

interface ILending {


    function getAssets() external view  returns (address[] memory);
}