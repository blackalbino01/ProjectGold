//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IChrysus {
  function RAY (  ) external view returns ( uint256 );
  function WAD (  ) external view returns ( uint256 );
  function addCollateralType ( address _collateralType, uint256 _collateralRequirement, address _oracleAddress ) external;
  function allowance ( address owner, address spender ) external view returns ( uint256 );
  function approve ( address spender, uint256 amount ) external returns ( bool );
  function approvedCollateral ( address ) external view returns ( bool approved, uint256 balance, uint256 fees, uint256 collateralRequirement, address oracle );
  function approvedTokens ( uint256 ) external view returns ( address );
  function auction (  ) external view returns ( address );
  function balanceOf ( address account ) external view returns ( uint256 );
  function collateralRatio (  ) external view returns ( uint256 );
  function collateralizationRatio (  ) external view returns ( uint256 );
  function decimals (  ) external view returns ( uint8 );
  function decreaseAllowance ( address spender, uint256 subtractedValue ) external returns ( bool );
  function depositCollateral ( address _collateralType, uint256 _amount ) external;
  function ethBalance (  ) external view returns ( uint256 );
  function ethFees (  ) external view returns ( uint256 );
  function governance (  ) external view returns ( address );
  function increaseAllowance ( address spender, uint256 addedValue ) external returns ( bool );
  function liquidate ( address _collateralType ) external;
  function liquidationRatio (  ) external view returns ( uint256 );
  function stabilityModule (  ) external view returns ( address );
  function swapRouter (  ) external view returns ( address );
  function swapSolution (  ) external view returns ( address );
  function totalSupply (  ) external view returns ( uint256 );
  function transfer ( address to, uint256 amount ) external returns ( bool );
  function transferFrom ( address from, address to, uint256 amount ) external returns ( bool );
  function treasury (  ) external view returns ( address );
  function userDeposits ( address, address ) external view returns ( uint256 deposited, uint256 minted );
  function withdrawCollateral ( address _collateralType, uint256 _amount ) external;
  function withdrawFees (  ) external;
}
