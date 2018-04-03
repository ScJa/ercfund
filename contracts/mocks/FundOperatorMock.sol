pragma solidity ^0.4.19;

import "../FundOperator.sol";

// @title FundOperatorMock
// @dev This class is only used in order to be able to test internal functions directly
// @author ScJa
contract FundOperatorMock is FundOperator {

    function FundOperatorMock(uint256 _hotThreshold, uint256 _trustPartyThreshold, address[] _hotAccounts, address[] _trustPartyAccounts)
        public
        FundOperator(_hotThreshold, _trustPartyThreshold, _hotAccounts, _trustPartyAccounts) {
    }

    function verifyHotAction(uint8[] _sigV, bytes32[] _sigR, bytes32[] _sigS, bytes32 _preHash)
        external
        view
    {
        _verifyHotAction(_sigV, _sigR, _sigS, _preHash);
    }

    function verifyTrustPartyAction(uint8[] _sigV, bytes32[] _sigR, bytes32[] _sigS, bytes32 _preHash)
        external
        view
    {
        _verifyTrustPartyAction(_sigV, _sigR, _sigS, _preHash);
    }

    function verifyColdStorageAccess(uint8 _sigV, bytes32 _sigR, bytes32 _sigS, bytes32 _preHash, address _wallet)
        external
    {
        _verifyColdStorageAccess(_sigV, _sigR, _sigS, _preHash, _wallet);
    }

    function verifyTransfer(uint8[] _sigV, bytes32[] _sigR, bytes32[] _sigS, bytes32 _preHash, FundWallet _from, address _to, uint256 _value)
        external
    {
        _verifyTransfer(_sigV, _sigR, _sigS, _preHash, _from, _to, _value);
    }


}
