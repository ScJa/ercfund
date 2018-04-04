pragma solidity ^0.4.21;

import "./open-zeppelin/math/SafeMath.sol";
import "./open-zeppelin/lifecycle/Pausable.sol";
import "./FundWallet.sol";
import "./FundToken.sol";

// @title Fund
// @dev This is middle component of the fund and provides all the functionality needed to manage an open-ended fund.
// It supports adding a mintable token for representing shares of the fund
// Shares of the fund can be bought after the crowdsale has commenced at a dynamic price set by the owners.
// Similarly shares can also be sold at any point for Ether (some closed-end funds do not provide this feature)
// The fund supports moving Ether from a set of internal wallets. In reality this wallets would be both hot and
// cold wallets if large sums are managed. For the usage of cold wallet a multi-sig management contract is required.
// This fund can be managed from a simple account wallet or by a multi-sig contract. A suggestion for a multi-sig
// contract with a strong focus on trust is presented in the FundOperator contract.
// This class currently provides no support for initial crowdsales, but can be easily extended.
// @author ScJa
contract Fund is FundWallet, Pausable {
    using SafeMath for uint256;

    // Fee which is subtracted on any withdraw. Amount requested for withdraw * withdraw fee = Amount received by the
    // account withdrawing. This means a withdraw fee of 3% means WITHDRAW_FEE should be 97.
    uint256 constant public WITHDRAW_FEE = 97;
    // Fee which is subtracted on any purchase. Calculation works the same as for WITHDRAW_FEE
    uint256 constant public PURCHASE_FEE = 97;

    // Represents the shares of the fund
    FundToken public token;

    // Struct which is used to save the conversion rate from tokens to wei
    // Wei * numerator / denominator = tokens
    struct Price {
        uint256 numerator;
        uint256 denominator;
    }

    // Current price at which tokens can be bought and sold. It might be helpful to split this into
    // purchasePrice and withdrawPrice.
    Price public currentPrice;

    // @dev Ensures that the fund has a token already added to it
    modifier hasToken {
        require(address(token) != address(0));
        _;
    }

    // @dev Ensures that the price for tokens is initiated an not zero
    modifier priceSet {
        require(currentPrice.numerator != 0);
        require(currentPrice.denominator != 0);
        _;
    }

    // @dev Ensures that the address given is not the zero address
    // @param _address Address checked
    modifier notNull(address _address) {
        require(_address != address(0));
        _;
    }

    // @dev Event which logs the purchase of tokens
    // @param from Address which purchased the tokens
    // @param to Address which received the tokens bought by "from"
    // @param tokensPurchased Amount of tokens purchased
    // @param etherReceived Amount of wei used to purchase the tokens. This wei is received by the fund.
    event Purchase(address indexed from, address indexed to, uint256 tokensPurchased, uint256 etherReceived);

    // @dev Event which logs the withdrawal/selling of tokens for Ether
    // @param from Address from which tokens are sold from
    // @param to Address to which the Ether received for the withdrawal is sent to
    // @param tokensWithdrawn Amount of tokens withdrawn/sold
    // @param etherSent Amount of wei received in exchange for the tokens sold. Amount of wei sent out by the fund.
    event Withdrawal(address indexed from, address indexed to, uint256 tokensWithdrawn, uint256 etherSent);

    // @dev Logs when a withdrawal fails because of insufficient balance of the fund
    // @param from Address from which tokens should be sold from
    // @param to Address to which the Ether received for the withdrawal should be sent to
    // @param tokensWithdrawn Amount of tokens which should have been withdrawn/sold
    // @param etherSent Amount of wei which would have been received in exchange for the tokens sold.
    // Amount of wei which would have been sent out by the fund.
    event FailedWithdrawal(address indexed from, address indexed to, uint256 tokensWithdrawn, uint256 etherSent);

    // @dev Logs the updates of the price for tokens. numerator/denominator = price
    // @param numerator The new numerator for the price
    // @param denominator The new denominator for the price
    event PriceUpdate(uint256 numerator, uint256 denominator);

    // @dev Logs the movement of Ether between wallets
    // @param from Wallet from which the Ether was sent
    // @param to Address to which the Ether was sent
    // @param value Amount of wei sent
    event EtherMoved(address indexed from, address indexed to, uint256 value);

    // @dev Logs the movement of tokens between wallets
    // @param token The address to the ERC20 compatible token of which tokens are moved
    // @param from Address from which tokens were sent
    // @param to Address to which the tokens were sent
    // @param value Amount of tokens sent
    event TokensMoved(address indexed token, address indexed from, address indexed to, uint256 value);

    // @dev Logs when a token was added to the fund. Can only be emitted once
    // @param token Address of the token which is added to fund as a representation of shares.
    event FundTokenAdded(address token);

    // @dev Simple constructor which only adds the owner
    // @param _owner Address of the owner of the fund
    function Fund(address _owner) FundWallet( _owner)
        public
    {
    }

    // @dev Function to add a token to the fund in order to represent shares of the fund
    // @param _token FundToken which will be used to represent shares
    function addToken(FundToken _token)
        public
        onlyOwner
        notNull(_token)
    {
        require(token == address(0));
        token = _token;
        emit FundTokenAdded(address(token));
    }

    // @dev Withdraw function which is used to sell your shares/tokens of the fund in exchange for Ether
    // The amount of Ether received in exchange for tokens is calculated based on the current price and withdraw fee
    // In the case of a successful withdrawal the tokens received are burned.
    // Can fail if the fund does no have enough Ether
    // Purposely no withdrawal pattern was implemented because the use case is simple enough here IMO
    // @param _to Address to which the Ether received in exchange for the tokens is sent to
    // @param _value Amount of tokens to withdrawn/sold
    function withdrawTo(address _to, uint256 _value)
        external
        hasToken
        whenNotPaused
        priceSet
        notNull(_to)
    {
        require(_value != 0);
        require(token.balanceOf(msg.sender) >= _value);
        address requestor = msg.sender;
        uint256 convertedValue = currentPrice.denominator.mul(_value).div(currentPrice.numerator);
        uint256 withdrawValue = convertedValue.mul(WITHDRAW_FEE).div(100);
        if (address(this).balance >= withdrawValue) {
            token.burn(requestor, _value);
            _to.transfer(withdrawValue);
            emit Withdrawal(requestor, _to, _value, withdrawValue);
        } else {
            emit FailedWithdrawal(requestor, _to, _value, withdrawValue);
        }
    }

    // @dev Purchase function which is used to buy shares/tokens in exchange for Ether
    // The amount of tokens received in exchange for Ether is calculated based on the current price and purchase fee
    // @param _to Address to which the purchased tokens will be credited to.
    function buyTo(address _to)
        public
        payable
        hasToken
        whenNotPaused
        priceSet
        notNull(_to)
    {
        require(msg.value != 0);
        uint256 convertedValue = msg.value.mul(currentPrice.numerator).div(currentPrice.denominator);
        uint256 purchaseValue = convertedValue.mul(PURCHASE_FEE).div(100);
        token.mint(_to, purchaseValue);
        emit Purchase(msg.sender, _to, purchaseValue, msg.value);
    }

    // @dev Simple function which updates the current price of the tokens/shares
    // @param _numerator Numerator of the currentPrice
    // @param _denominator Denominator of the currentPrice
    function updatePrice(uint256 _numerator, uint256 _denominator)
        public
        onlyOwner
    {
        require(_numerator != 0);
        require(_denominator != 0);
        currentPrice.numerator = _numerator;
        currentPrice.denominator = _denominator;
        emit PriceUpdate(_numerator, _denominator);
    }

    // @dev Initiates a token transfer between two wallets
    // @param _token ERC20-compatible token of which tokens are moved
    // @param _from Address from which tokens are sent from
    // @param _to Address to which the tokens are sent to
    // @param _value Amount of tokens sent
    function moveTokens(ERC20 _token, FundWallet _from, address _to, uint256 _value)
        public
        onlyOwner
    {
        _from.sendTokens(_token, _to, _value);
        emit TokensMoved(address(_token), _from, _to, _value);
    }

    // @dev Initiates an Ether transfer between two wallets
    // @param _from Address from which the Ether is sent from
    // @param _to Address to which the Ether is sent
    // @param _value Amount of wei sent
    function moveEther(FundWallet _from, address _to, uint256 _value)
        public
        onlyOwner
    {
        _from.sendEther(_to, _value);
        emit EtherMoved(_from, _to, _value);
    }

    // @dev Payable function which is used to add funds.
    function addFunds()
        public
        payable
    {
    }

    // @dev Payable function which automatically initiates the purchase process for the sender
    // This functionality is implement to be more user-friendly and make the purchase process easier.
    function ()
        public
        payable
    {
        buyTo(msg.sender);
    }

}
