pragma solidity ^0.8.0;

contract MockOracle {

    int256 public _answer;

    function latestRoundData() external view
    returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {

        return (roundId, _answer, startedAt, updatedAt, answeredInRound);
    }

    function setValue(int256 value) external {

        _answer = value;

    }

}

interface IMockOracle {

    function latestRoundData() external view
    returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );

    function setValue(int256 value) external;

}