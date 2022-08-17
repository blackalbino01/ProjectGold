//SPDX-License-Identifier: MIT
pragma solidity >0.8.0;

contract MockLending {

    address governance;
    // slither-disable-next-line uninitialized-state
    address[] assets;

    constructor(address _governance) {
        governance = _governance;
    }
    
    // slither-disable-next-line uninitialized-state
    function getAssets() external view returns (address[] memory){
        return assets;
    }
}