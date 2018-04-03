import EVMRevert from "./open-zeppelin/helpers/EVMRevert";
import ether from "./open-zeppelin/helpers/ether";

const BigNumber = web3.BigNumber;

const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const FundWallet = artifacts.require("FundWallet");
const SimpleToken = artifacts.require("SimpleToken");

contract("FundWallet", ([owner, sender, receiver]) => {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    let wallet;
    const initialBalance = ether(1);
    const amountToSend = ether(0.2);

    beforeEach(async () => {
        wallet = await FundWallet.new(owner, {from: sender});
    });


    describe("initialization", () => {

        describe("when the owner is the zero address", () => {
            it("should revert", async () => {
                await FundWallet.new(ZERO_ADDRESS, {from: sender}).should.be.rejectedWith(EVMRevert);
            });
        });

        it("should have an owner", async () => {
            const owner_ = await wallet.owner();
            owner_.should.equal(owner);
        });

    });

    describe("fallback", () => {

        it("should receive ether sent", async () => {
            await wallet.send(initialBalance).should.be.fulfilled;
        });

        it("should emit received event", async () => {
            const {logs} = await wallet.sendTransaction({value: initialBalance, from: sender});
            const event = logs.find(e => e.event === "Received");
            const balance = await web3.eth.getBalance(wallet.address);

            logs.length.should.equal(1);
            should.exist(event);
            event.args.from.should.equal(sender);
            event.args.value.should.be.bignumber.equal(initialBalance);
            event.args.balance.should.be.bignumber.equal(balance);
        });

    });

    // When sent to Owner is tested in Fund.test.js
    describe("sendEther", () => {

        beforeEach(async () => {
            await wallet.sendTransaction({value: initialBalance, from: sender});
        });

        describe("when the sender is not the owner", () => {
            it("should revert", async () => {
                await wallet.sendEther(receiver, amountToSend, {from: sender}).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when the sender is the owner", () => {

            it("should transfer the correct amount", async () => {
                const balanceReceiverPre = await web3.eth.getBalance(receiver);
                await wallet.sendEther(receiver, amountToSend, {from: owner});
                const balanceWallet = await web3.eth.getBalance(wallet.address);
                const balanceReceiverPost = await web3.eth.getBalance(receiver);

                balanceWallet.should.be.bignumber.equal(initialBalance - amountToSend);
                balanceReceiverPost.minus(balanceReceiverPre)
                    .should.be.bignumber.equal(amountToSend);
            });

            it("should emit a SentEther event", async () => {
                const {logs} = await wallet.sendEther(receiver, amountToSend, {from: owner});
                const event = logs.find(e => e.event === "EtherSent");
                const balance = await web3.eth.getBalance(wallet.address);

                logs.length.should.equal(1);
                should.exist(event);
                event.args.to.should.equal(receiver);
                event.args.value.should.be.bignumber.equal(amountToSend);
                event.args.balance.should.be.bignumber.equal(balance);
            });

        });

    });

    describe("sendTokens", () => {
        let token;
        const initialBalance = 100000;
        const tokensToSend = 100;

        beforeEach(async () => {
            token = await SimpleToken.new({from: sender});
            await token.transfer(wallet.address, initialBalance, {from: sender});
        });

        describe("when the sender is not the owner", () => {
            it("should revert", async () => {
                await wallet.sendTokens(token.address, receiver, tokensToSend, {from: sender})
                    .should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when the sender is the owner", () => {

            describe("when the sender does not have enough tokens", () => {
                it("should revert", async () => {
                    await wallet.sendTokens(token.address, receiver, initialBalance + 1, {from: owner})
                        .should.be.rejectedWith(EVMRevert);
                });
            });

            it("should transfer the correct amount", async () => {
                await wallet.sendTokens(token.address, receiver, tokensToSend, {from: owner});
                const balanceReceiver = await token.balanceOf(receiver);

                balanceReceiver.should.be.bignumber.equal(tokensToSend);
            });

            it("should emit a SentTokens event", async () => {
                const {logs} = await wallet.sendTokens(token.address, receiver, tokensToSend, {from: owner});
                const event = logs.find(e => e.event === "TokensSent");

                logs.length.should.equal(1);
                should.exist(event);
                event.args.token.should.equal(token.address);
                event.args.to.should.equal(receiver);
                event.args.value.should.be.bignumber.equal(tokensToSend);
            });

        });

    });

});