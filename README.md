# ERCfund
### An open-ended hedge fund implementation on the Ethereum blockchain for managing ERC20 tokens.
![Fund architecture](./imgs/ercfund.png)

## What is ERCFund?
ERCFund makes it possible to invest into an actively managed portfolio of ERC20-Tokens and Ether by introducing a on-demand minted and burned token as the medium for shares in the fund. 
Compared to some other closed-end funds (e.g., TaaS.fund, The Token Fund) you can buy shares/tokens at any time by simply sending Ether to the fund.
These shares/tokens can also be sold at any time by calling the withdraw function of the fund which sends the corresponding value of Ether back to a specified wallet.

Fund managers can freely trade with these tokens and hopefully make profits. Based on the assets under management the price for one token should be continously updated.


### Vision
Currently investing in a range of different cryptocurrencies requires a lot of technical knowledge. This has spawned the need for easy way to invest while reducing entry barriers. Multiple well-known and successful initiatives are on the market like Crypto20, ICONOMI, Melon, Grayscale, etc. 

However the sector of cryptocurrency investment is difficult to enter for smaller, independent investors who possess market knowledge and are experienced in traditional fields but simply lack the technical knowledge to offer a product in the cryptocurrency sector.

ERCFund strives to provide an safe, extensible implementation of a hedge fund for ERC20 tokens. Security and trust is immensly important for lesser known players. For this reason all parts of the fund are rigorously tested and reuse community-audited code from OpenZeppelin. Furthermore it provides the possibility to add external trust parties to the management team which can make prospective investors feel secure by preventing fund managers to mishandle their money.

### Architecture 


In the picture above you can get a rough overview of the implementation. The whole fund structure can be setup with the four Solidity classes:

- FundOperator.sol
- Fund.sol
- FundToken.sol
- FundWallet.sol

#### Fund
The fund is the connection piece between all of the classes. It implements the core functionality of a hedge fund. The fund can manage an arbitrary number of wallets and can send Ether or ERC20-compatible tokens from these wallets.

Additionally the fund lets interested individuals purchase and sell "shares" of the fund in the form of a FundToken. These tokens are dynamically created and burned based on the current price of the fund and fees of the fund. This price should be continously updated by the fund operators.

#### FundToken
The fund token is standard, burnable and mintable ERC20 token. The token itself does not implement any direct functionality of the fund. However it is different to normal burnable tokens in the way that only the owner (the fund) can burn tokens.

#### FundOperator
The FundOperator class is multi-signature contract on top of the fund class in order to introduce a layer of security. It is different to other multi-signature wallets (like the Gnosis multi-sig wallet) in several ways.

Owners of the FundOperator are split into two different groups: the fund managers and the trust party. Depending on the actions called in the FundOperator class either only signatures of the fund managers are needed or signatures of both groups. Members of the trust party group could be e.g., an external audit firm, a group of significant investors or generally trusted personalities. 

Still, the trust party group is fully optional!

The idea behind this trust structure is that the fund managers can normally trade and manage the funds within a defined trusted area (e.g., internal wallets and exchanges). If they want to introduce a new wallet or send to an untrusted wallet they have to get additional signatures. This prevents anybody managing the fund from maliciously moving Ether or tokens.

Furthermore the FundOperator class implements the addition of cold wallets to the fund, which are especially safe wallets which were never connected to the internet.
This is possible because signing an action for fund happens off-chain instead of on-chain (like the Gnosis multi-sig wallet). Signing on-chain has pros and cons, the main pro is, is that it is simpler to use, because you do not need a special application to sign your transactions off-chain. The cons are that transactions are more expensive, because you need to send a confirmation from key holder, also signing off-chain is arguably more secure if done right.
An actively managed fund might need to make hundreds of transactions every day, signing off-chain decreases transaction cost significantly.

## FAQ

#### [Why does the fund not implement the withdraw pattern?](.FAQ.md#why-does-the-fund-not-implement-the-withdraw-pattern)
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






























