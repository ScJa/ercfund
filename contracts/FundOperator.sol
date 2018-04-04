pragma solidity ^0.4.21;

import "./open-zeppelin/math/SafeMath.sol";
import "./FundToken.sol";
import "./FundWallet.sol";
import "./FundToken.sol";
import "./Fund.sol";

// @title FundOperator
// @dev This class is a suggestion for an implementation of a multi-sig operator of the Fund class
// Every function of the Fund class can be called from here, therefore this class should be used as the owner of the Fund
// The multi-sig verification implemented here puts a special focus by implementing two different sets of keys
// used to access the operator. The hotAccounts represent the fund managers while the trustPartyAccounts represent
// external trust accounts such as service providers, exchanged or known personalities.
// The idea is that the normal management of the fund is possible by the fund managers, but if the fund managers
// want to send fund to an unknown/untrusted wallet the transaction has to be confirmed by trust parties as well
// This functionality offers a strong argument for trust and security because the fund managers cannot take of with the money
// However this functionality can be disabled by setting the trust threshold to zero.
// The multi-signature verification method is different from common patterns used by e.g. the Gnosis multi-sig wallet
// All the signing happens off-chain which reduces gas cost drastically because only one transaction is needed to
// authorize an action.
// The signatures used here follow the ERC191 signature scheme: https://github.com/ethereum/EIPs/issues/191
// Every function in this class requires signatures in the form of v, r, s. These signatures have to match the
// purpose of the action. These parameters are not described for every function.
// The format in which the signatures have to be given are an array which contains all signatures as follows:
// | hotSignatures | trustPartySignatures (if necessary) | coldSignature (if necessary |
// To see how to sign a transaction in the correct way check out the test cases in ../test/FundOperator.test.js
// @author ScJa
contract FundOperator {
    using SafeMath for uint256;

    // Enum which is used to uniquely identify every Action the operator can authorize. This is used for signatures.
    enum Action {AddFund, AddToken, AddTrustedWallets, AddColdWallet, EtherTransfer, TokenTransfer, PriceUpdate, Pause}

    // The fund which is managed by the operator
    Fund public fund;

    // Used for multi-signature purposes to uniquely identify every transaction
    uint256 public nonce;

    // Amount of signatures required from hot accounts for every transaction
    uint256 public hotThreshold;

    // Amount of signatures required for special actions which are not part of every day management actions
    uint256 public trustPartyThreshold;

    // Saves all hot accounts which manage the fund
    mapping(address => bool) public isHotAccount;

    // Saves all trust party accounts
    mapping(address => bool) public isTrustPartyAccount;

    // Saves all cold wallets used by the fund and the cold key used to protect the wallet.
    // Format: (Wallet storing funds) => (cold account required for access)
    mapping(address => address) public coldStorage;


    // Used for storing funds which can be quickly accessed
    mapping(address => bool) public isHotWallet;

    // Set of wallets which includes all wallets owned by the fund but can also contain other trusted such as exchanges
    mapping(address => bool) public isTrustedWallet;

    // The following five arrays are not used internally but added for public access to all addresses used
    address[] public hotAccounts;
    address[] public coldAccounts;
    address[] public trustPartyAccounts;
    FundWallet[] public hotWallets;
    FundWallet[] public coldWallets;

    // @dev Logs which fund is added for the operator to manage. Can only be emitted once
    // @param fund Address to fund managed
    event FundAdded(address fund);

    // @dev Logs the addition of the token added to the fund which represents the shares of the fund
    // @param token Address to the token added to the fund
    event FundTokenAuthorized(address token);

    // @dev Logs all hot wallets added to the operator
    // @param wallet Address added as a hot wallet
    event HotWalletAdded(address indexed wallet);

    // @dev Logs cold wallets added to the operator
    // @param wallet Address to the cold wallet
    // @param key Address to the cold key which is needed to unlock the wallet.
    event ColdWalletAdded(address indexed wallet, address indexed key);

    // @dev Logs when a trusted wallet is added. Both the addition of hot wallets and cold wallets will also emit this event.
    // @param wallet Address to the trusted wallet
    event TrustedWalletAdded(address indexed wallet);

    // @dev Logs whenever a cold wallet is accessed in a transfer
    // @param wallet Address of the cold wallet accessed
    event ColdWalletAccessed(address indexed wallet);

    // @dev Logs whenever a transfer of Ether is authorized
    // @param from Wallet from which the Ether was sent
    // @param to Address to which the Ether was sent
    // @param value Amount of wei sent
    event EtherTransferAuthorized(address indexed from, address indexed to, uint256 value);

    // @dev Logs the authorization of a transfer of tokens
    // @param token The address to the ERC20 compatible token of which tokens are moved
    // @param from Address from which tokens were sent
    // @param to Address to which the tokens were sent
    // @param value Amount of tokens sent
    event TokenTransferAuthorized(address indexed token, address indexed from, address indexed to, uint256 value);

    // @dev Logs the authorization of a price update
    // @param numerator The new numerator for the price
    // @param denominator The new denominator for the price
    event PriceUpdateAuthorized(uint256 numerator, uint256 denominator);

    // @dev Logs the authorization of the pausing of the fund
    event PauseAuthorized();

    // @dev Logs the authorization of the unpausing of the fund
    event UnpauseAuthorized();

    // @dev Verifies the operator already has a fund added
    modifier hasFund() {
        require(address(fund) != 0);
        _;
    }

    // @dev Verifies an address is not the zero address
    // @param _address
    modifier notNull(address _address) {
        require(_address != 0);
        _;
    }

    // @dev Constructor which adds all hot accounts and trust party accounts to the fund. No more accounts of this
    // type can be added at a later point. To change them redeploy a new version of all components.
    // Does not allow for any duplicates. No trustparty accounts have to be added.
    // @param _hotTreshold Amount of signatures from hot accounts needed to confirm every action in this class
    // @param _trustPartyThreshold Amount of signatures needed from trust parties for extraordinary actions
    // @param _hotAccounts Array of addresses of hot accounts
    // @param _trustPartyAccounts Array of addresses of trust party accounts
    function FundOperator (uint256 _hotThreshold, uint256 _trustPartyThreshold, address[] _hotAccounts, address[] _trustPartyAccounts)
        public
    {
        require(_hotAccounts.length <= 10 && _hotAccounts.length != 0);
        require(_trustPartyAccounts.length <= 10);
        require(_hotThreshold <= _hotAccounts.length && _hotThreshold != 0);
        require(_trustPartyThreshold <= _trustPartyAccounts.length);

        for (uint256 i = 0; i < _hotAccounts.length; i++) {
            require(!isHotAccount[_hotAccounts[i]] && _hotAccounts[i] != 0);
            isHotAccount[_hotAccounts[i]] = true;
        }

        for (i = 0; i < _trustPartyAccounts.length; i++) {
            require(!isHotAccount[_trustPartyAccounts[i]]);
            require(!isTrustPartyAccount[_trustPartyAccounts[i]] && _trustPartyAccounts[i] != 0);
            isTrustPartyAccount[_trustPartyAccounts[i]] = true;
        }

        hotThreshold = _hotThreshold;
        trustPartyThreshold = _trustPartyThreshold;
        hotAccounts = _hotAccounts;
        trustPartyAccounts = _trustPartyAccounts;
    }

    // @dev Adds the fund to be managed to the operator
    // Requires trust party to sign
    // @param _fund Address to the fund to be added/managed
    function addFund(uint8[] _sigV, bytes32[] _sigR, bytes32[] _sigS, Fund _fund)
        external
        notNull(_fund)
    {
        require(address(fund) == 0);
        bytes32 preHash = keccak256(this, uint256(Action.AddFund), _fund, nonce);
        _verifyHotAction(_sigV, _sigR, _sigS, preHash);
        _verifyTrustPartyAction(_sigV, _sigR, _sigS, preHash);
        fund = _fund;
        isHotWallet[fund] = true;
        isTrustedWallet[fund] = true;
        emit FundAdded(fund);
        nonce = nonce.add(1);
    }

    // @dev Adds the token to the fund managed by the operator
    // Requires trust party to sign
    // @param _token Address of the token to be added
    function addToken(uint8[] _sigV, bytes32[] _sigR, bytes32[] _sigS, FundToken _token)
        external
        hasFund
    {
        bytes32 preHash = keccak256(this, uint256(Action.AddToken), _token, nonce);
        _verifyHotAction(_sigV, _sigR, _sigS, preHash);
        _verifyTrustPartyAction(_sigV, _sigR, _sigS, preHash);
        emit FundTokenAuthorized(_token);
        nonce = nonce.add(1);
        fund.addToken(_token);
    }

    // @dev Adds an array of trusted wallets or hot wallets. Hot wallets are hot and trusted
    // Requires trust party to sign
    // @param _wallets Array of wallets to add to the fund
    // @param _hot Says whether the wallets added should be both hot and trusted or only trusted
    function addTrustedWallets(uint8[] _sigV, bytes32[] _sigR, bytes32[] _sigS, FundWallet[] _wallets, bool _hot)
        external
        hasFund
    {
        bytes32 preHash = keccak256(this, uint256(Action.AddTrustedWallets), _wallets, _hot, nonce);
        _verifyHotAction(_sigV, _sigR, _sigS, preHash);
        _verifyTrustPartyAction(_sigV, _sigR, _sigS, preHash);
        for (uint256 i = 0; i < _wallets.length; i++) {
            require(!isTrustedWallet[_wallets[i]]);
            require(_wallets[i].owner() == address(fund));
            isTrustedWallet[_wallets[i]] = true;
            emit TrustedWalletAdded(_wallets[i]);
            if (_hot) {
                isHotWallet[_wallets[i]] = true;
                hotWallets.push(_wallets[i]);
                emit HotWalletAdded(_wallets[i]);
            }
        }
        nonce = nonce.add(1);
    }

    // @dev Adds a single cold wallet with the corresponding cold key to the fund.
    // Requires trsut party to sign
    // @param _wallet Address to the cold wallet to add
    // @param _key Address to the cold account needed to access the cold wallet at a later point
    function addColdWallet(uint8[] _sigV, bytes32[] _sigR, bytes32[] _sigS, FundWallet _wallet, address _key)
        external
        notNull(_wallet)
    {
        require(!isTrustedWallet[_wallet]);
        require(_wallet.owner() == address(fund));
        bytes32 preHash = keccak256(this, uint256(Action.AddColdWallet), _wallet, _key, nonce);
        _verifyHotAction(_sigV, _sigR, _sigS, preHash);
        _verifyTrustPartyAction(_sigV, _sigR, _sigS, preHash);

        isTrustedWallet[_wallet] = true;
        coldWallets.push(_wallet);
        coldStorage[_wallet] = _key;
        coldAccounts.push(_key);

        _verifyColdStorageAccess(_sigV[_sigV.length - 1], _sigR[_sigR.length - 1], _sigS[_sigS.length - 1], preHash, _wallet);
        emit ColdWalletAdded(_wallet, _key);
        emit TrustedWalletAdded(_wallet);
        nonce = nonce.add(1);
    }

    // @dev Function is used internally to verify access whenever a transfer from a cold wallet is initiated
    // See test cases for an example on how the signatures can be generated correctly in Javascript
    // @param _preHash Hash to check the signatures against
    // @param _wallet Cold wallet to be accessed
    function _verifyColdStorageAccess(uint8 _sigV, bytes32 _sigR, bytes32 _sigS, bytes32 _preHash, address _wallet)
        internal
    {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 txHash = keccak256(prefix, _preHash);
        address recovered = ecrecover(txHash, _sigV, _sigR, _sigS);
        require(coldStorage[_wallet] == recovered);
        emit ColdWalletAccessed(_wallet);
    }

    // @dev Internal function to verify every action taken in this class. Check the signatures given against the
    // preHash to check if the all the signatures are correct. The hot signatures have to be the first elements of the
    // signature arrays.
    // See test cases for an example on how the signatures can be generated correctly in Javascript
    // @param _preHash Hash to check the signatures against
    function _verifyHotAction(uint8[] _sigV, bytes32[] _sigR, bytes32[] _sigS, bytes32 _preHash)
        view
        internal
    {
        require(_sigV.length >= hotThreshold);
        require(_sigR.length == _sigS.length && _sigR.length == _sigV.length);
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 txHash = keccak256(prefix, _preHash);

        // Loop is ensuring that there are no duplicates by checking the addresses are strictly increasing
        address lastAdd = 0;
        for (uint256 i = 0; i < hotThreshold; i++) {
            address recovered = ecrecover(txHash, _sigV[i], _sigR[i], _sigS[i]);
            require(recovered > lastAdd);
            require(isHotAccount[recovered]);
            lastAdd = recovered;
        }
    }

    // @dev Internal function to verify all actions which need special confirmation from the trust parties.
    // The trust party signatures have to be appended after the hot signatures.
    // See test cases for an example on how the signatures can be generated correctly in Javascript
    // @param _preHash Hash to check the signatures against
    function _verifyTrustPartyAction(uint8[] _sigV, bytes32[] _sigR, bytes32[] _sigS, bytes32 _preHash)
        view
        internal
    {
        require(_sigV.length >= hotThreshold.add(trustPartyThreshold));
        require(_sigR.length == _sigS.length && _sigR.length == _sigV.length);
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 txHash = keccak256(prefix, _preHash);

        // Loop is ensuring that there are no duplicates by checking the addresses are strictly increasing
        address lastAdd = 0;
        for (uint256 i = hotThreshold; i < hotThreshold + trustPartyThreshold; i++) {
            address recovered = ecrecover(txHash, _sigV[i], _sigR[i], _sigS[i]);
            require(recovered > lastAdd);
            require(isTrustPartyAccount[recovered]);
            lastAdd = recovered;
        }
    }

    // @dev Internal function called for both ether and token transfer in order to reduce duplicate code
    // Check whether the address to send from is a wallet of the fund.
    // Depending on if it is sending from a cold wallet or sending to an untrusted wallet different signatures are verified
    // @param _preHash Hash to check signatures against
    // @param _from Wallet to transfer funds from
    // @param _to Wallet to transfer funds to
    // @param _value Amount of either wei or tokens to send
    function _verifyTransfer(uint8[] _sigV, bytes32[] _sigR, bytes32[] _sigS, bytes32 _preHash, FundWallet _from, address _to, uint256 _value)
        internal
    {
        require(isHotWallet[_from] || coldStorage[_from] != 0);
        require(_value > 0);
        _verifyHotAction(_sigV, _sigR, _sigS, _preHash);
        if (coldStorage[_from] != 0) {
            // Double length check for safety
            require(_sigR.length == _sigS.length && _sigR.length == _sigV.length);
            uint256 coldKeyPos = _sigV.length - 1;
            _verifyColdStorageAccess(_sigV[coldKeyPos], _sigR[coldKeyPos], _sigS[coldKeyPos], _preHash, _from);
        }
        if (!isTrustedWallet[_to]) {
            _verifyTrustPartyAction(_sigV, _sigR, _sigS, _preHash);
        }
        nonce = nonce.add(1);
    }

    // @dev Authorizes an Ether transfer between two wallets
    // If sending to an untrusted wallet requires trust party to sign
    // @param _from Address from which the Ether is sent from
    // @param _to Address to which the Ether is sent
    // @param _value Amount of wei sent
    function requestEtherTransfer(uint8[] _sigV, bytes32[] _sigR, bytes32[] _sigS, FundWallet _from, address _to, uint256 _value)
        external
        hasFund
    {
        bytes32 preHash = keccak256(this, uint256(Action.EtherTransfer), _from, _to, _value, nonce);
        _verifyTransfer(_sigV, _sigR, _sigS, preHash, _from, _to, _value);

        // Triggers external call
        fund.moveEther(FundWallet(_from), _to, _value);
        emit EtherTransferAuthorized(_from, _to, _value);
    }

    // @dev Authorizes a token transfer between two wallets
    // If sending to an untrusted wallet requires trust party to sign
    // @param _token ERC20-compatible token of which tokens are moved
    // @param _from Address from which tokens are sent from
    // @param _to Address to which the tokens are sent to
    // @param _value Amount of tokens sent
    function requestTokenTransfer(uint8[] _sigV, bytes32[] _sigR, bytes32[] _sigS, ERC20 _token, FundWallet _from, address _to, uint256 _value)
        external
        hasFund
    {
        bytes32 preHash = keccak256(this, int256(Action.TokenTransfer), _token, _from, _to, _value, nonce);
        _verifyTransfer(_sigV, _sigR, _sigS, preHash, _from, _to, _value);

        // Triggers external call
        fund.moveTokens(_token, _from, _to, _value);
        emit TokenTransferAuthorized(address(_token), _from, _to, _value);
    }

    // @dev Authorizes the fund to update the price for a token/share
    // @param _numerator Numerator for the new price
    // @param _denominator Denominator for the new price
    function requestPriceUpdate(uint8[] _sigV, bytes32[] _sigR, bytes32[] _sigS, uint256 _numerator, uint256 _denominator)
        external
        hasFund
    {
        // Double check to fail fast
        require(_numerator != 0 && _denominator != 0);
        bytes32 preHash = keccak256(this, uint256(Action.PriceUpdate), _numerator, _denominator, nonce);
        _verifyHotAction(_sigV, _sigR, _sigS, preHash);
        nonce = nonce.add(1);
        fund.updatePrice(_numerator, _denominator);
        emit PriceUpdateAuthorized(_numerator, _denominator);
    }

    // @dev Authorizes the pausing or unpausing of the fund
    // @param _pause If true the fund will be paused, if false the fund will be unpaused.
    function requestPause(uint8[] _sigV, bytes32[] _sigR, bytes32[] _sigS, bool _pause)
        external
        hasFund
    {
        bytes32 preHash = keccak256(this, uint256(Action.Pause), _pause, nonce);
        _verifyHotAction(_sigV, _sigR, _sigS, preHash);
        nonce = nonce.add(1);
        if (_pause) {
            fund.pause();
            emit PauseAuthorized();
        } else {
            fund.unpause();
            emit UnpauseAuthorized();
        }
    }

}
