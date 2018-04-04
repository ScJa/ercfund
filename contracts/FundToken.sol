pragma solidity ^0.4.21;

import "./open-zeppelin/token/ERC20/MintableToken.sol";

// @title FundToken
// @dev This class is a simple mintable, burnable token which is used as the basis of the fund for representing shares.
// With the Fund class a token is used to represent ownership of a fraction of the underlying assets of the fund.
// @author ScJa
contract FundToken is MintableToken {

    // Name of the token
    string public name = "FundToken";

    // Symbol of the token, also used to list it
    string public symbol = "FND";

    // Decimals represents the fraction to which the token can be split.
    uint8 public decimals = 18;

    // @dev Event to log the burning of tokens
    // @param from Address from which tokens are burned
    // @param value Amount of tokens burned
    event Burn(address indexed from, uint256 value);

    // @dev Simple constructer which allows for dynamic owner initiation
    // @param _owner Address which is set as the owner of the token
    function FundToken(address _owner)
        public
    {
        owner = _owner;
        totalSupply_ = 0;
    }

    // @dev Slightly adapted burn function which allows only the owner of the token to burn tokens
    // In a normal context this would be not advised if the owner is an account wallet because it introduces absolute
    // power and a big security risk. A burn function like this only makes sense if the owner is a smart contract,
    // in our case the Fund class, which allows burning only if initiated by the _holder
    // @param _holder Address from which account tokens are burned from
    // @param _value Amount of tokens burnt
    function burn(address _holder, uint256 _value)
        external
        onlyOwner
    {
        // To avoid "double burning" misinformation through events
        require(_holder != address(0));
        require(_value <= balances[_holder]);

        balances[_holder] = balances[_holder].sub(_value);
        totalSupply_ = totalSupply_.sub(_value);
        // Emits two events because there is no clear standard as to which one is used for burning events
        emit Burn(_holder, _value);
        emit Transfer(_holder, address(0), _value);
    }

}
