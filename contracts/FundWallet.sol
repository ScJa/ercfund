pragma solidity ^0.4.19;

import "./open-zeppelin/ownership/Ownable.sol";
import "./open-zeppelin/token/ERC20/ERC20.sol";
import "./Fund.sol";


// @title FundWallet
// @dev The FundWallet represents one of the basic building blocks of managing Ether and tokens within the fund.
// Basically the contract is a basic ERC20 compatible wallet which has some small adjustments to integrate better
// with the Fund contract.
// @author ScJa
contract FundWallet is Ownable {

    // @dev Event for logging an Ether Transfer
    // @param to Address to which the Ether is sent to
    // @param value Amount sent in the course of the Ether transfer
    // @param balance Remaining balance of wallet after the transfer in wei
    event EtherSent(address indexed to, uint256 value, uint256 balance);

    // @dev Event for logging when Ether is received by the wallet
    // @param from Address from which the Ether was sent
    // @param value Amount received
    // @param balance Balance of the wallet after receiving value
    event Received(address indexed from, uint256 value, uint256 balance);

    // @dev Event for logging when a token transfer is requested
    // @param token Address to the ERC20-compatible token of which tokens are sent
    // @param to Address to which the tokens are sent to
    // @param value Amount of tokens sent
    event TokensSent(address indexed token, address indexed to, uint256 value);

    // @dev Slightly adjusted ownership modifier because the fund itself is also a fund wallet. This allows it to
    // to send funds by calling function within this class internally
    modifier onlyOwnerOrInternal() {
        require(msg.sender == owner || msg.sender == address(this));
        _;
    }

    // @dev Checks if address_ is the zero address
    // @param _address Address to check
    modifier notNull(address _address) {
        require(_address != 0);
        _;
    }

    // @dev Simple constructor which allows to specify a different owner then the msg.sender
    // @param  _owner Address which will be set to be the owner of this wallet
    function FundWallet(address _owner)
        public
        notNull(_owner)
    {
        owner = _owner;
    }


    // @dev Function which initiates a simple Ether transfer. It is adjusted to work well with Fund class
    // @param _to Address to which Ether is sent
    // @param _value Amount of wei sent
    function sendEther(address _to, uint256 _value)
        public
        onlyOwnerOrInternal
        notNull(_to)
    {
        require(_value > 0);

        // Special behaviour here which increases usability for the Fund by avoiding accidental payments instead of
        // purchasing tokens.
        if (_to == owner) {
            Fund fund = Fund(_to);
            fund.addFunds.value(_value)();
        } else {
            // External call
            _to.transfer(_value);
        }
        EtherSent(_to, _value, this.balance);
    }

    // @dev Function which initiates a simple token transfer
    // @param _token ERC20 compatible token of which tokens are sent
    // @param _to Address to which tokens are sent to
    // @param _value Amount of token sent
    function sendTokens(ERC20 _token, address _to, uint256 _value)
        public
        onlyOwnerOrInternal
        notNull(_to)
    {
        require(_value > 0);
        // External call
        require(_token.transfer(_to, _value));
        TokensSent(_token, _to, _value);
    }

    // @dev Default payable function which logs any Ether recieved
    function ()
        public
        payable
    {
        Received(msg.sender, msg.value, this.balance);
    }

}