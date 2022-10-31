//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IGovernance {

    function proposeVote(address _contract, bytes4 _function, bytes memory _data) external;

    function executeVote(uint256 _voteCount) external;

    function vote(uint256 _voteCount, bool _supports, bool _abstains) external;

    function transfer ( address to, uint256 amount ) external returns ( bool );

    function transferFrom ( address from, address to, uint256 amount ) external returns ( bool );

    function team () external returns (address);
}