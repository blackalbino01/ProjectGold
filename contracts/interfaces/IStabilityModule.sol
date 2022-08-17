//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IStabilityModule {

    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        uint256 withdrawAmount;
        uint256 lastGovContractCall;
    }

    function addTokens(address _collateralType, uint256 _amount)
        external
        payable;

    function stake(uint256 _amount) external;

    function getGovernanceStake(address _staker) external view returns(Stake memory);

    function getTotalPoolAmount() external view returns(uint256);

    function transferFrom ( address from, address to, uint256 amount ) external returns ( bool );

}
