//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface ILending {


    function getAssets() external view  returns (address[] memory);
}