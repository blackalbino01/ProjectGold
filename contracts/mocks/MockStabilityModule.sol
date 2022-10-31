//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "contracts/interfaces/IGovernance.sol";
import "contracts/libraries/Math.sol";
import "contracts/interfaces/IChrysus.sol";

contract MockStabilityModule {


    using DSMath for uint256;
    address governance;

    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        uint256 withdrawAmount;
        uint256 lastGovContractCall;
    }

    uint256 totalPoolAmount;

    mapping(address => Stake) public governanceStakes;

    constructor(address _governance) {
        governance = _governance;
    }

    function stake(uint256 _amount) external {

        Stake storage s = governanceStakes[msg.sender];
        s.startTime = block.timestamp;
        s.endTime = type(uint256).max;
        s.amount += _amount;
        s.lastGovContractCall = block.timestamp;

        totalPoolAmount += _amount;

        IGovernance(governance).transferFrom(msg.sender, address(this), _amount);

    }

    function requestWithdraw(uint256 _amount) external {

        Stake storage s = governanceStakes[msg.sender];
        require(_amount <= s.amount, "can't withdraw more than current stake");
        
        s.endTime = block.timestamp;
        s.withdrawAmount = _amount;

    }

    function withdrawStake(address _collateralType) external {

        Stake storage s = governanceStakes[msg.sender];

        require(block.timestamp - s.endTime > 30 days);

        s.amount -= s.withdrawAmount;
        s.endTime = block.timestamp;
        totalPoolAmount -= s.withdrawAmount;

        uint256 amount;

        uint256 stakingReward = DSMath.wmul(DSMath.wdiv(s.amount, totalPoolAmount),  IChrysus(governance).balanceOf(address(this)));
        uint256 collateralReward = DSMath.wmul(DSMath.wdiv(s.amount, totalPoolAmount),  IChrysus(_collateralType).balanceOf(address(this)));

        amount = s.withdrawAmount + stakingReward;
        s.withdrawAmount = 0;

        bool success = IGovernance(governance).transfer(msg.sender, amount);
        require(success);
        success = IGovernance(_collateralType).transfer(msg.sender, collateralReward);
        require(success);
    }

    function updateLastGovContractCall(address _voter) external {
        require(msg.sender == governance);

        governanceStakes[_voter].lastGovContractCall = block.timestamp;

    }

    function getGovernanceStake(address _staker) external view returns(Stake memory){
        return governanceStakes[_staker];
    }

    function getTotalPoolAmount() external view returns(uint256){
        return totalPoolAmount;
    }
}