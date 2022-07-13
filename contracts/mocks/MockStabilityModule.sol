pragma solidity ^0.8.0;

contract MockStabilityModule {

    mapping(address => uint256) balances;

    function addTokens(address _collateralType, uint256 _amount)
        external
        payable {

            balances[_collateralType] += _amount;

        }
}