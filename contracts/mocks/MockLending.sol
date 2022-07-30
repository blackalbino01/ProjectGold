pragma solidity >0.8.0;

contract MockLending {

    address governance;
    address[] assets;

    constructor(address _governance) {
        governance = _governance;
    }

    function getAssets() public view returns (address[] memory){
        return assets;
    }
}