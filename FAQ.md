## FAQ

### Why does the fund not implement the withdraw pattern? 
The commonly used [withdraw pattern](http://solidity.readthedocs.io/en/v0.4.21/common-patterns.html#withdrawal-from-contracts) is an immensly useful pattern and agree it is best practice. Usually the main reason for using a withdraw pattern is to avoid having state changes before the withdrawal which can then be reverted if the receiver's fallback function throws. 

In the case of the withdraw function of the fund, no complicated logic or important state changes happen before the withdrawal. If the withdrawer should purposely throw in his fallback function, nothing bad would happen besides burning some gas. 

If however you would e.g., change the updatePrice function to directly update the price before a withdrawal, this pattern might be useful.

### I do not understand the signature verification in the FundOperator class
This is completely understandable: Manual signatures in Solidity are tricky to implement and from my experience not especially user-friendly. 
Basically the idea is to sign a message off-chain with the required number of private keys from the fund managers. This way you obtain a number of signatures which you then pass on split into their respective V, R and S parts which are the output of the EXDSA signing method. 
Within each Solidity function the purpose of the transaction is checked if it matches the signatures via the ecrecover method. 

The signatures used follow the [ERC191](https://github.com/ethereum/EIPs/issues/191) specification.

For examples on how to sign transaction it is surely helpful to look at the tests in the test/FundOperator.test.js

### What are the pros of an open-ended fund compared to a closed-end fund?
Closed-end funds only allow investment at one point in time, usually in the form of an ICO. Afterwards no more money can be invested in the fund. This can lead to two common scenarios:
If the fund is well-managed and produces profit, shares of the fund are sold at a premium price, meaning you e.g., pay 20% more for a share then the underlying assets are actually worth.
If the fund actively loses money, many investors will try to sell their shares to other people. This can lead to shares being sold for less than they are worth because investors are afraid of losing more.

These problems are solved in an open-ended fund: If a new investor wants to buy shares they can simply send Ether to the Fund's address which then dynamically mints new tokens (shares) based on the amount send.
If they fund is losing money, people can sell their shares/tokens directly to the fund and receive Ether based on the underlying assets of a share.

This way you can make sure shares are never sold for significantly more or less than their underlying assets are worth.