import ether from "./open-zeppelin/helpers/ether";
import EVMRevert from "./open-zeppelin/helpers/EVMRevert";

const BigNumber = web3.BigNumber;

const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const Fund = artifacts.require("Fund");
const FundWallet = artifacts.require("FundWallet");
const FundToken = artifacts.require("FundToken");
const SimpleToken = artifacts.require("SimpleToken");


contract("Fund", ([owner, sender, receiver]) => {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const initialBalance = ether(1);
    const amountToSend = ether(0.2);
    const numerator = 3, denominator = 7;
    let fund, token;

    beforeEach(async () => {
        fund = await Fund.new(owner, {from: sender});
    });


    describe("initialization", () => {
        it("should have the correct owner", async () => {
            const owner_ = await fund.owner();
            owner_.should.equal(owner);
        });
    });

    describe("addToken", () => {
        describe("when the sender is not the owner", () => {
            it("should revert", async () => {
                token = await FundToken.new(fund.address, {from: sender});
                await fund.addToken(token.address, {from: sender}).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when the sender is owner", () => {

            describe("when the token address is the zero address", () => {
                it("should revert", async () => {
                    await fund.addToken(ZERO_ADDRESS, {from: sender}).should.be.rejectedWith(EVMRevert);
                });
            });

            describe("when given a valid token", () => {

                describe("when the token is already set", () => {
                    it("should revert", async () => {
                        let token1 = await FundToken.new(fund.address, {from: sender});
                        let token2 = await FundToken.new(fund.address, {from: sender});
                        await fund.addToken(token1.address, {from: owner});
                        await fund.addToken(token2.address, {from: owner}).should.be.rejectedWith(EVMRevert);
                    });
                });

                describe("when the token is not yet set", () => {

                    it("should set the token value", async () => {
                        await fund.addToken(token.address, {from: owner});
                        (await fund.token()).should.equal(token.address);
                    });

                    it("should emit a FundTokenAdded event", async () => {
                        let {logs} = await fund.addToken(token.address, {from: owner});
                        const tokAddedEvent = logs.find(e => e.event === "FundTokenAdded");
                        logs.length.should.equal(1);
                        tokAddedEvent.args.token.should.equal(token.address);
                    });

                });

            });

        });

    });

    describe("updatePrice", () => {

        describe("when the sender is not the owner", () => {
            it("should revert", async () => {
                await fund.updatePrice(numerator, denominator, {from: sender}).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when the sender is owner", () => {

            describe("when the numerator is zero", () => {
                it("should revert", async () => {
                    await fund.updatePrice(0, denominator, {from: owner}).should.be.rejectedWith(EVMRevert);
                });
            });

            describe("when the denominator is zero", () => {
                it("should revert", async () => {
                    await fund.updatePrice(numerator, 0, {from: owner}).should.be.rejectedWith(EVMRevert);
                });
            });

            describe("when given a valid numerator and denominator", () => {

                it("should set the price", async () => {
                    await fund.updatePrice(numerator, denominator, {from: owner});
                    (await fund.currentPrice())[0].should.be.bignumber.equal(numerator);
                    (await fund.currentPrice())[1].should.be.bignumber.equal(denominator);
                });

                it("should emit a PriceUpdate event", async () => {
                    let {logs} = await fund.updatePrice(numerator, denominator, {from: owner});
                    const updPriceEvent = logs.find(e => e.event === "PriceUpdate");
                    logs.length.should.equal(1);
                    updPriceEvent.args.numerator.should.be.bignumber.equal(numerator);
                    updPriceEvent.args.denominator.should.be.bignumber.equal(denominator);
                });

            });

        });

    });

    describe("moveEther", () => {

        beforeEach(async () => {
            await fund.addFunds({from: sender, value: initialBalance});
        });

        describe("when the sender is not the owner", () => {
            it("should revert", async () => {
                await fund.moveEther(fund.address, receiver, amountToSend, {from: sender})
                    .should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when the sender is the owner", () => {

            describe("when ether is sent from the fund", () => {

                it("should move the correct amount", async () => {
                    const balanceReceiverPre = await web3.eth.getBalance(receiver);
                    await fund.moveEther(fund.address, receiver, amountToSend, {from: owner});
                    const balanceWallet = await web3.eth.getBalance(fund.address);
                    const balanceReceiverPost = await web3.eth.getBalance(receiver);

                    balanceWallet.should.be.bignumber.equal(initialBalance.minus(amountToSend));
                    balanceReceiverPost.minus(balanceReceiverPre)
                        .should.be.bignumber.equal(amountToSend);
                });

                it("should emit an EtherMoved event", async () => {
                    const {logs} = await fund.moveEther(fund.address, receiver, amountToSend, {from: owner});
                    const ethMovedEvent = logs.find(e => e.event === "EtherMoved");
                    const ethSentEvent = logs.find(e => e.event === "EtherSent");

                    logs.length.should.equal(2);
                    should.exist(ethMovedEvent);
                    // SentEther event tested in FundWallet
                    should.exist(ethSentEvent);
                    ethMovedEvent.args.from.should.equal(fund.address);
                    ethMovedEvent.args.to.should.equal(receiver);
                    ethMovedEvent.args.value.should.be.bignumber.equal(amountToSend);
                });

            });

            describe("when ether is sent from a wallet owned by the fund to the fund", () => {
                it("should move the correct amount", async () => {
                    let wallet = await FundWallet.new(fund.address, {from: sender});
                    await web3.eth.sendTransaction({from: sender, to: wallet.address, value: initialBalance});

                    const balanceReceiverPre = await web3.eth.getBalance(fund.address);
                    await fund.moveEther(wallet.address, fund.address, amountToSend, {from: owner});
                    const balanceWallet = await web3.eth.getBalance(wallet.address);
                    const balanceReceiverPost = await web3.eth.getBalance(fund.address);

                    balanceWallet.should.be.bignumber.equal(initialBalance.minus(amountToSend));
                    balanceReceiverPost.minus(balanceReceiverPre)
                        .should.be.bignumber.equal(amountToSend);
                });
            });

        });

    });

    describe("moveTokens", () => {
        let erc20Token;
        let totalSupply;
        let tokensToSend = 100;

        beforeEach(async () => {
            erc20Token = await SimpleToken.new({from: sender});
            totalSupply = await erc20Token.INITIAL_SUPPLY();
            await erc20Token.transfer(fund.address, totalSupply, {from: sender});
        });

        describe("when the sender is not the owner", () => {
            it("should revert", async () => {
                await fund.moveTokens(erc20Token.address, fund.address, receiver, tokensToSend, {from: sender})
                    .should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when the sender is the owner", () => {

            describe("when tokens are moved from the fund", () => {

                it("should move the correct amount", async () => {
                    await fund.moveTokens(erc20Token.address, fund.address, receiver, tokensToSend, {from: owner});
                    const balanceWallet = await erc20Token.balanceOf(fund.address);
                    const balanceReceiver = await erc20Token.balanceOf(receiver);

                    balanceWallet.should.be.bignumber.equal(totalSupply.minus(tokensToSend));
                    balanceReceiver.should.be.bignumber.equal(tokensToSend);
                });

                it("should emit a TokensMoved event", async () => {
                    const {logs} = await fund.moveTokens(erc20Token.address, fund.address, receiver, tokensToSend, {from: owner});
                    const tokMovedEvent = logs.find(e => e.event === "TokensMoved");
                    const tokSentEvent = logs.find(e => e.event === "TokensSent");

                    logs.length.should.equal(2);
                    should.exist(tokMovedEvent);
                    // SentEther event tested in FundWallet
                    should.exist(tokSentEvent);
                    tokMovedEvent.args.token.should.equal(erc20Token.address);
                    tokMovedEvent.args.from.should.equal(fund.address);
                    tokMovedEvent.args.to.should.equal(receiver);
                    tokMovedEvent.args.value.should.be.bignumber.equal(tokensToSend);
                });

            });

            describe("when tokens are moved from a wallet owned by the fund", () => {
                it("should move the correct amount", async () => {
                    let wallet = await FundWallet.new(fund.address, {from: sender});
                    await fund.moveTokens(erc20Token.address, fund.address, wallet.address, totalSupply, {from: owner});
                    await fund.moveTokens(erc20Token.address, wallet.address, receiver, tokensToSend, {from: owner});
                    const balanceWallet = await erc20Token.balanceOf(wallet.address);
                    const balanceReceiver = await erc20Token.balanceOf(receiver);

                    balanceWallet.should.be.bignumber.equal(totalSupply.minus(tokensToSend));
                    balanceReceiver.should.be.bignumber.equal(tokensToSend);
                });
            });

        });

    });

    describe("buyTo", () => {
        let purchaseFee;

        describe("when the fund has no token", () => {
           it("should revert", async () => {
               await fund.updatePrice(numerator, denominator);
               await fund.buyTo(receiver, {from: sender, value: amountToSend}).should.be.rejectedWith(EVMRevert);
           });
        });

        describe("when the price is not set", () => {
            it("should revert", async () => {
                token = await FundToken.new(fund.address, {from: sender});
                await fund.addToken(token.address, {from: owner});
                await fund.buyTo(receiver, {from: sender, value: amountToSend}).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when the fund has a token", () => {

            beforeEach(async () => {
                token = await FundToken.new(fund.address, {from: sender});
                await fund.addToken(token.address, {from: owner});
                await fund.updatePrice(numerator, denominator);
                purchaseFee = await fund.PURCHASE_FEE();
            });

            describe("when the fund is paused", () => {
                it("should revert", async () => {
                    await fund.pause();
                    await fund.buyTo(receiver, {from: sender, value: amountToSend}).should.be.rejectedWith(EVMRevert);
                });
            });

            describe("when the address is zero", () => {
                it("should revert", async () => {
                    await fund.buyTo(ZERO_ADDRESS, {from: sender, value: amountToSend}).should.be.rejectedWith(EVMRevert);
                });
            });

            describe("when the fund is unpaused, the price is set and the address is not zero", () => {

                describe("when the value is zero", () => {
                   it("should revert", async () => {
                       await fund.buyTo(receiver, {from: sender}).should.be.rejectedWith(EVMRevert);
                   });
                });

                describe("when the value is not zero", () => {

                    it("should mint the correct amount to the reciever", async () => {
                        await fund.buyTo(receiver, {from: sender, value: amountToSend});
                        let convertedValue = amountToSend.mul(numerator).dividedToIntegerBy(denominator);
                        let tokensShouldRecieve = convertedValue.mul(purchaseFee).dividedToIntegerBy(100);

                        let recieverBal = await token.balanceOf(receiver);
                        recieverBal.should.be.bignumber.equal(tokensShouldRecieve);
                    });

                    it("should emit a Purchase event", async () => {
                        const {logs} = await fund.buyTo(receiver, {from: sender, value: amountToSend});
                        let convertedValue = amountToSend.mul(numerator).dividedToIntegerBy(denominator);
                        let tokensShouldRecieve = convertedValue.mul(purchaseFee).dividedToIntegerBy(100);

                        const purchaseEvent = logs.find(e => e.event === "Purchase");
                        logs.length.should.equal(1);
                        purchaseEvent.args.from.should.equal(sender);
                        purchaseEvent.args.to.should.equal(receiver);
                        purchaseEvent.args.tokensPurchased.should.be.bignumber.equal(tokensShouldRecieve);
                        purchaseEvent.args.etherReceived.should.be.bignumber.equal(amountToSend);
                    });

                });

            });

        });

    });

    describe("withdrawTo", () => {
        let withdrawFee, tokensHeld;
        const tokensToWithdraw = 100;

        beforeEach(async () => {
            token = await FundToken.new(fund.address, {from: sender});
            await fund.addToken(token.address, {from: owner});
            await fund.updatePrice(numerator, denominator);

            withdrawFee = await fund.WITHDRAW_FEE();
            let purchaseFee = await fund.PURCHASE_FEE();

            let convertedValue = amountToSend.mul(numerator).dividedToIntegerBy(denominator);
            tokensHeld = convertedValue.mul(purchaseFee).dividedToIntegerBy(100);
            await fund.buyTo(sender, {from: sender, value: amountToSend});
        });

        describe("when the fund is paused", () => {
            it("should revert", async () => {
                await fund.pause();
                await fund.withdrawTo(receiver, tokensToWithdraw, {from: sender}).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when the address is zero", () => {
            it("should revert", async () => {
                await fund.withdrawTo(ZERO_ADDRESS, tokensToWithdraw, {from: sender}).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when the fund is unpaused and the address is not zero", () => {

            describe("when the value is zero", () => {
                it("should revert", async () => {
                    await fund.withdrawTo(receiver, 0, {from: sender}).should.be.rejectedWith(EVMRevert);
                });
            });

            describe("when the sender does not have enough tokens", () => {
                it("should revert", async () => {
                    await fund.withdrawTo(receiver, tokensHeld, {from: sender});
                    await fund.withdrawTo(receiver, tokensToWithdraw, {from: sender}).should.be.rejectedWith(EVMRevert);
                });
            });

            describe("when the value is not zero and the sender has enough tokens", () => {

                describe("when the fund does not have enough ether to send", () => {

                    it("should emit a FailedWithdrawal event", async () => {
                        let fundBal = await web3.eth.getBalance(fund.address);
                        await fund.moveEther(fund.address, sender, fundBal);
                        const {logs} = await fund.withdrawTo(receiver, tokensToWithdraw, {from: sender});
                        let convertedValue = Math.trunc(tokensToWithdraw * denominator / numerator);
                        let etherShouldRecieve = withdrawFee.mul(convertedValue).dividedToIntegerBy(100);

                        const purchaseEvent = logs.find(e => e.event === "FailedWithdrawal");
                        logs.length.should.equal(1);
                        purchaseEvent.args.from.should.equal(sender);
                        purchaseEvent.args.to.should.equal(receiver);
                        purchaseEvent.args.tokensWithdrawn.should.be.bignumber.equal(tokensToWithdraw);
                        purchaseEvent.args.etherSent.should.be.bignumber.equal(etherShouldRecieve);
                    });

                    it("should not burn any tokens", async () => {
                        let fundBal = await web3.eth.getBalance(fund.address);
                        let preBal = await token.balanceOf(sender);
                        await fund.moveEther(fund.address, sender, fundBal);
                        await fund.withdrawTo(receiver, tokensToWithdraw, {from: sender});

                        (await token.balanceOf(sender)).should.be.bignumber.equal(preBal);
                    });

                });

                it("should burn the correct amount of tokens from the seller", async () => {
                    let preRecieverTok = await token.balanceOf(sender);
                    let preSupply = await token.totalSupply();
                    await fund.withdrawTo(receiver, tokensToWithdraw, {from: sender});

                    (await token.balanceOf(sender)).should.be.bignumber.equal(preRecieverTok.minus(tokensToWithdraw));
                    (await token.totalSupply()).should.be.bignumber.equal(preSupply.minus(tokensToWithdraw));
                });

                it("should send the correct amount of ether to the reciever", async () => {
                    let preSenderBal = await web3.eth.getBalance(fund.address)
                    let preRecieverBal = await web3.eth.getBalance(receiver);
                    await fund.withdrawTo(receiver, tokensToWithdraw, {from: sender});
                    let convertedValue = Math.trunc(tokensToWithdraw * denominator / numerator);
                    let etherShouldRecieve = withdrawFee.mul(convertedValue).dividedToIntegerBy(100);

                    let postSenderBal = await web3.eth.getBalance(fund.address);
                    let postRecieverBal = await web3.eth.getBalance(receiver);
                    postSenderBal.should.be.bignumber.equal(preSenderBal.minus(etherShouldRecieve));
                    postRecieverBal.should.be.bignumber.equal(preRecieverBal.plus(etherShouldRecieve));
                });

                it("should emit a Withdrawal event", async () => {
                    const {logs} = await fund.withdrawTo(receiver, tokensToWithdraw, {from: sender});
                    let convertedValue = Math.trunc(tokensToWithdraw * denominator / numerator);
                    let etherShouldRecieve = withdrawFee.mul(convertedValue).dividedToIntegerBy(100);

                    const purchaseEvent = logs.find(e => e.event === "Withdrawal");
                    logs.length.should.equal(1);
                    purchaseEvent.args.from.should.equal(sender);
                    purchaseEvent.args.to.should.equal(receiver);
                    purchaseEvent.args.tokensWithdrawn.should.be.bignumber.equal(tokensToWithdraw);
                    purchaseEvent.args.etherSent.should.be.bignumber.equal(etherShouldRecieve);
                });

            });

        });

    });

    describe("fallback", () => {

        it("should buy tokens to the message sender", async () => {
            token = await FundToken.new(fund.address, {from: sender});
            await fund.addToken(token.address, {from: owner});
            await fund.updatePrice(numerator, denominator);
            let purchaseFee = await fund.PURCHASE_FEE();
            let withdrawFee = await fund.WITHDRAW_FEE();
            await web3.eth.sendTransaction({from: sender, to: fund.address, value: amountToSend});
            let convertedValue = amountToSend.mul(numerator).dividedToIntegerBy(denominator);
            let tokensShouldRecieve = convertedValue.mul(purchaseFee).dividedToIntegerBy(100);

            let recieverBal = await token.balanceOf(sender);
            recieverBal.should.be.bignumber.equal(tokensShouldRecieve);
        });
    });

});