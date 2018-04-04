import EVMRevert from "./open-zeppelin/helpers/EVMRevert";
import ether from "./open-zeppelin/helpers/ether";

const BigNumber = web3.BigNumber;
const leftPad = require('left-pad');
const Web3Utils = require('web3-utils');
const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const Fund = artifacts.require("Fund");
const FundOperator = artifacts.require("FundOperatorMock");
const FundToken = artifacts.require("FundToken");
const FundWallet = artifacts.require("FundWallet");
const SimpleToken = artifacts.require("SimpleToken");

const Actions = Object.freeze({
    AddFund: 0,
    AddToken: 1,
    AddTrustedWallets: 2,
    AddColdWallet: 3,
    EtherTransfer: 4,
    TokenTransfer: 5,
    UpdatePrice: 6,
    Pause: 7
});


// This test requires a lot of accounts, make sure to start your test environment accordingly
contract("FundOperator", (accounts) => {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    let sender = accounts[0];
    let externalW = accounts[1];
    let coldKey = accounts[2];
    let hotAccounts = accounts.slice(5, 15);
    let trustAccounts = accounts.slice(15, 25);
    let sortedHotAccounts = hotAccounts.sort();
    let sortedTrustAccounts = trustAccounts.sort();
    let signees = sortedHotAccounts.slice(0, 3).concat(sortedTrustAccounts.slice(0, 3));
    let operator;

    beforeEach(async () => {
        operator = await FundOperator.new(3, 3, hotAccounts, trustAccounts, {from: sender});
    });

    describe("initialization", () => {

        describe("when given more than allowed hotAccounts", () => {
            it("should revert", async () => {
                await FundOperator.new(3, 3, accounts.slice(5, 16), accounts.slice(16, 26), {from: sender})
                    .should.be.rejectedWith(EVMRevert);

            });
        });

        describe("when given more than allowed trustparties", () => {
            it("should revert", async () => {
                await FundOperator.new(3, 3, accounts.slice(5, 15), accounts.slice(15, 26), {from: sender})
                    .should.be.rejectedWith(EVMRevert);

            });
        });

        describe("when the owner threshold is set too high", () => {
            it("should revert", async () => {
                await FundOperator.new(7, 3, accounts.slice(5, 10), accounts.slice(15, 20), {from: sender})
                    .should.be.rejectedWith(EVMRevert);

            });
        });

        describe("when the trustparty threshold is set too high", () => {
            it("should revert", async () => {
                await FundOperator.new(3, 7, accounts.slice(5, 10), accounts.slice(15, 20), {from: sender})
                    .should.be.rejectedWith(EVMRevert);

            });
        });

        describe("when the zero address is given in the hot accounts", () => {
            it("should revert", async () => {
                await FundOperator.new(3, 3, accounts.slice(5, 14).concat(ZERO_ADDRESS), accounts.slice(15, 25), {from: sender})
                    .should.be.rejectedWith(EVMRevert);

            });
        });

        describe("when the zero address is given in the trustparty accounts", () => {
            it("should revert", async () => {
                await FundOperator.new(3, 3, accounts.slice(5, 15), accounts.slice(15, 24).concat(ZERO_ADDRESS), {from: sender})
                    .should.be.rejectedWith(EVMRevert);

            });
        });

        describe("when duplicate in owner array", () => {
            it("should revert", async () => {
                await FundOperator.new(3, 3, accounts.slice(5, 14).concat(accounts[5]), accounts.slice(15, 25), {from: sender})
                    .should.be.rejectedWith(EVMRevert);

            });
        });

        describe("when duplicate in trustparty array ", () => {
            it("should revert", async () => {
                await FundOperator.new(3, 3, accounts.slice(5, 15), accounts.slice(15, 24).concat(accounts[15]), {from: sender})
                    .should.be.rejectedWith(EVMRevert);

            });
        });

        describe("when duplicate of owner array in trustparty array ", () => {
            it("should revert", async () => {
                await FundOperator.new(3, 3, accounts.slice(5, 15), accounts.slice(15, 24).concat(accounts[5]), {from: sender})
                    .should.be.rejectedWith(EVMRevert);

            });
        });

        describe("when given a hot threshold of 0", () => {
            it("should revert", async () => {
                await FundOperator.new(0, 3, accounts.slice(5, 15), accounts.slice(15, 25), {from: sender})
                    .should.be.rejectedWith(EVMRevert);

            });
        });


        describe("when given 0 trustparty accounds and a trustparty threshold of 0", () => {
            it("should be successful", async () => {
                await FundOperator.new(3, 0, accounts.slice(5, 14), [], {from: sender})
                    .should.be.fulfilled;

            });
        });

        describe("when given 10 hotAccounts and trustparty and a threshold of 10", () => {
            it("should be successful", async () => {
                await FundOperator.new(10, 10, accounts.slice(5, 15), accounts.slice(15, 25), {from: sender})
                    .should.be.fulfilled;

            });
        });

        describe("when given 1 hotAccount and no trustparty and thresholds of 1 and 0 respectively", () => {
            it("should be successful", async () => {
                await FundOperator.new(1, 0, [accounts[5]], [], {from: sender})
                    .should.be.fulfilled;

            });
        });

        describe("when given 5 hotAccounts and trustparties and a threshold of 3 and 4 respectively", () => {
            it("should save all values correctly", async () => {
                operator = await FundOperator.new(3, 4, hotAccounts, trustAccounts, {from: sender});
                let firstHotAcc = await operator.hotAccounts(0);
                let firstTrustAcc = await operator.trustPartyAccounts(0);
                let lastHotAcc = await operator.hotAccounts(4);
                let lastTrustAcc = await operator.trustPartyAccounts(4);

                (await operator.hotThreshold()).should.be.bignumber.equal(3);
                (await operator.trustPartyThreshold()).should.be.bignumber.equal(4);
                firstHotAcc.should.equal(hotAccounts[0]);
                firstTrustAcc.should.equal(trustAccounts[0]);
                lastHotAcc.should.equal(hotAccounts[4]);
                lastTrustAcc.should.equal(trustAccounts[4]);
                (await operator.isHotAccount(hotAccounts[0])).should.be.true;
                (await operator.isHotAccount(hotAccounts[4])).should.be.true;
                (await operator.isTrustPartyAccount(trustAccounts[0])).should.be.true;
                (await operator.isTrustPartyAccount(trustAccounts[4])).should.be.true;
            });
        });

    });

    describe("verifyHotAction", () => {

        describe("when supplying too little correct signatures", () => {
            it("should revert", async () => {
                let dataToSign = Web3Utils.soliditySha3("Hello");
                let sigs = await createSigs(dataToSign, sortedHotAccounts.slice(0, 2));
                await operator.verifyHotAction(sigs.v, sigs.r, sigs.s, dataToSign).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when supplying the exact amount of wrong signatures", () => {
            it("should revert", async () => {
                let dataToSign = Web3Utils.soliditySha3("Hello");
                let sigs = await createSigs(dataToSign, trustAccounts.slice(0, 3).sort());
                await operator.verifyHotAction(sigs.v, sigs.r, sigs.s, dataToSign).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when supplying v, r, s arrays with different lengths", () => {
            it("should revert", async () => {
                let dataToSign = Web3Utils.soliditySha3("Hello");
                let sigs = await createSigs(dataToSign, sortedHotAccounts.slice(0, 3));
                await operator.verifyHotAction(sigs.v, sigs.r, sigs.s.slice(1), dataToSign).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when supplying the exact amount of correct signatures but unsorted", () => {
            it("should revert", async () => {
                let dataToSign = Web3Utils.soliditySha3("Hello");
                let sigs = await createSigs(dataToSign, sortedHotAccounts.slice(0, 3).reverse());
                await operator.verifyHotAction(sigs.v, sigs.r, sigs.s, dataToSign).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when supplying the exact amount of correct signatures but with a duplicate", () => {
            it("should revert", async () => {
                let dataToSign = Web3Utils.soliditySha3("Hello");
                let sigs = await createSigs(dataToSign, sortedHotAccounts.slice(0, 2).concat(sortedHotAccounts[1]));
                await operator.verifyHotAction(sigs.v, sigs.r, sigs.s, dataToSign).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when supplying the exact amount of correct signatures", () => {
            it("should be successful", async () => {
                let dataToSign = Web3Utils.soliditySha3("Hello");
                let sigs = await createSigs(dataToSign, sortedHotAccounts.slice(0, 3));
                await operator.verifyHotAction(sigs.v, sigs.r, sigs.s, dataToSign).should.be.fulfilled;
            });
        });

        describe("when the hotThreshold is one and given the correct sigs", () => {
            it("should be successful", async () => {
                operator = await FundOperator.new(1, 3, hotAccounts, trustAccounts, {from: sender});
                let dataToSign = Web3Utils.soliditySha3("Hello");8
                let sigs = await createSigs(dataToSign, [hotAccounts[0]]);
                await operator.verifyHotAction(sigs.v, sigs.r, sigs.s, dataToSign).should.be.fulfilled;
            });
        });

        // Should throw at a different point though
        describe("when supplying too many correct signatures", () => {
            it("should be successful", async () => {
                let dataToSign = Web3Utils.soliditySha3("Hello");
                let sigs = await createSigs(dataToSign, sortedHotAccounts.slice(0, 4));
                await operator.verifyHotAction(sigs.v, sigs.r, sigs.s, dataToSign).should.be.fulfilled;
            });
        });

    });

    // Most cases are tested within the verifyHotAction already, as the functions are nearly identical
    describe("verifyTrustAction", () => {

        describe("when only the exact amount of correct signatures is given", () => {
            it("should revert", async () => {
                let dataToSign = Web3Utils.soliditySha3("Hello");
                let sigs = await createSigs(dataToSign, sortedTrustAccounts.slice(0, 3));
                await operator.verifyTrustPartyAction(sigs.v, sigs.r, sigs.s, dataToSign)
                    .should.be.rejectedWith(EVMRevert);
            });
        });

        // Added in response to a critical code bug
        describe("when given the correct amount but only hot sigs", () => {
            it("should revert", async () => {
                let dataToSign = Web3Utils.soliditySha3("Hello");
                let sigs = await createSigs(dataToSign, sortedHotAccounts.slice(0, 6));
                await operator.verifyTrustPartyAction(sigs.v, sigs.r, sigs.s, dataToSign)
                    .should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when the exact amount of correct signatures is given and left-padded by hot threshold", () => {
            it("should be successful", async () => {
                let dataToSign = Web3Utils.soliditySha3("Hello");
                let sigs = await createSigs(dataToSign, signees);
                await operator.verifyTrustPartyAction(sigs.v, sigs.r, sigs.s, dataToSign)
                    .should.be.fulfilled;
            });
        });

        describe("when the trust treshold is 0", () => {
            it("should be successful even given random sigs", async () => {
                operator = await FundOperator.new(3, 0, hotAccounts, [], {from: sender});
                let dataToSign = Web3Utils.soliditySha3("Hello");
                let sigs = await createSigs(dataToSign, accounts.slice(0, 3));
                await operator.verifyTrustPartyAction(sigs.v, sigs.r, sigs.s, dataToSign)
                    .should.be.fulfilled;
            });
        });

    });

    describe("verifyColdAction", () => {

        describe("when signed by a hot account and given a non existent wallet", () => {
            it("should revert", async () => {
                let dataToSign = Web3Utils.soliditySha3("Hello");
                let sigs = await createSigs(dataToSign, [hotAccounts[0]]);
                await operator.verifyColdStorageAccess(sigs.v[0], sigs.r[0], sigs.s[0], dataToSign, hotAccounts[0])
                    .should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when given the correct input", () => {
            it("should emit an event", async () => {
                let fund = await Fund.new(operator.address, {from: sender});
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddFund, fund.address, 0);
                let sigs = await createSigs(dataToSign, signees);
                await operator.addFund(sigs.v, sigs.r, sigs.s, fund.address);
                let wallet = await FundWallet.new(fund.address, {from: sender});
                dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddColdWallet, wallet.address,
                    coldKey, 1);
                sigs = await createSigs(dataToSign, signees.concat(coldKey));
                await operator.addColdWallet(sigs.v, sigs.r, sigs.s, wallet.address, coldKey);

                dataToSign = Web3Utils.soliditySha3("Hello");
                sigs = await createSigs(dataToSign, [coldKey]);
                let {logs} = await operator.verifyColdStorageAccess(sigs.v[0], sigs.r[0], sigs.s[0], dataToSign, wallet.address);
                const event = logs.find(e => e.event === "ColdWalletAccessed");
                logs.length.should.equal(1);
                event.args.wallet.should.equal(wallet.address);
            })
        });

    });

    // All test cases for this method are currently covered in "requestEtherTransfer"
    // Something to refactor in the future for cleanliness
    // describe("verifyTransfer", () => {});

    describe("addFund", () => {
        let fund, sigs;

        beforeEach(async () => {
            fund = await Fund.new(operator.address, {from: sender});
        });

        describe("when given wrong sigs", () => {
            it("should revert", async () => {
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddFund, fund.address, 0);
                let wrongSignees = accounts.slice(0, 6).sort();
                sigs = await createSigs(dataToSign, wrongSignees);
                await operator.addFund(sigs.v, sigs.r, sigs.s, fund.address).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when given the zero address", () => {
            it("should revert", async () => {
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddFund, ZERO_ADDRESS, 0);
                sigs = await createSigs(dataToSign, signees);
                await operator.addFund(sigs.v, sigs.r, sigs.s, fund.address).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when the fund is already set", () => {
            it("should revert", async () => {
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddFund, fund.address, 0);
                sigs = await createSigs(dataToSign, signees);
                await operator.addFund(sigs.v, sigs.r, sigs.s, fund.address);
                dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddFund, fund.address, 1);
                sigs = await createSigs(dataToSign, signees);
                await operator.addFund(sigs.v, sigs.r, sigs.s, fund.address).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when the fund is not yet set and a correct fund address is given", () => {

            beforeEach(async () => {
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddFund, fund.address, 0);
                sigs = await createSigs(dataToSign, signees);
            });

            it("should set all variables correctly and increase the nonce", async () => {
                await operator.addFund(sigs.v, sigs.r, sigs.s, fund.address);

                (await operator.nonce()).should.be.bignumber.equal(1);
                (await operator.fund()).should.equal(fund.address);
                (await operator.isHotWallet(fund.address)).should.be.true;
                (await operator.isTrustedWallet(fund.address)).should.be.true;
            });

            it("should emit a FundAdded event", async () => {
                let {logs} = await operator.addFund(sigs.v, sigs.r, sigs.s, fund.address);
                const fundAddedEvent = logs.find(e => e.event === "FundAdded");

                logs.length.should.equal(1);
                fundAddedEvent.args.fund.should.equal(fund.address);
            });

        });

    });

    describe("addToken", () => {
        let token, fund, sigs;

        beforeEach(async () => {
            fund = await Fund.new(operator.address, {from: sender});
            token = await FundToken.new(fund.address, {from: sender});
        });

        describe("when the fund is not added", () => {
            it("should revert", async () => {
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddToken, token.address, 0);
                sigs = await createSigs(dataToSign, signees);

                await operator.addToken(sigs.v, sigs.r, sigs.s, token.address).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when the fund is added", () => {

            beforeEach(async () => {
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddFund, fund.address, 0);
                sigs = await createSigs(dataToSign, signees);
                await operator.addFund(sigs.v, sigs.r, sigs.s, fund.address);

                dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddToken, token.address, 1);
                sigs = await createSigs(dataToSign, signees);
            });

            describe("when given wrong sigs", () => {
                it("should revert", async () => {
                    let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddToken, token.address, 1);
                    let wrongSignees = accounts.slice(0, 6).sort();
                    sigs = await createSigs(dataToSign, wrongSignees);
                    await operator.addToken(sigs.v, sigs.r, sigs.s, token.address).should.be.rejectedWith(EVMRevert);
                });
            });

            it("should add the token and increase the nonce", async () => {
                await operator.addToken(sigs.v, sigs.r, sigs.s, token.address);

                (await fund.token()).should.equal(token.address);
                (await operator.nonce()).should.be.bignumber.equal(2);
            });

            it("should emit a FundTokenAuthorized event", async () => {
                let {logs} = await operator.addToken(sigs.v, sigs.r, sigs.s, token.address);

                let event = logs.find(e => e.event === "FundTokenAuthorized");
                logs.length.should.equal(1);
                event.args.token.should.equal(token.address);
            });

        });

    });

    describe("addTrustedWallets", () => {
        let fund;

        beforeEach(async () => {
            fund = await Fund.new(operator.address, {from: sender});
            let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddFund, fund.address, 0);
            let sigs = await createSigs(dataToSign, signees);
            await operator.addFund(sigs.v, sigs.r, sigs.s, fund.address);
        });

        describe("when given wrong signatures", () => {
            it("should revert", async () => {
                let hotWallets = [(await FundWallet.new(fund.address, {from: sender})).address];
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddTrustedWallets, {
                    t: "address[]",
                    v: hotWallets
                }, false, 1);
                let sigs = await createSigs(dataToSign, sortedHotAccounts.slice(0, 3));
                await operator.addTrustedWallets(sigs.v, sigs.r, sigs.s, hotWallets, false).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when given a wallet that is already a trusted wallet", () => {
            it("should revert", async () => {
                let hotWallets = [(await FundWallet.new(fund.address, {from: sender})).address];
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddTrustedWallets, {
                    t: "address[]",
                    v: hotWallets
                }, false, 1);
                let sigs = await createSigs(dataToSign, signees);
                await operator.addTrustedWallets(sigs.v, sigs.r, sigs.s, hotWallets, false);

                dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddTrustedWallets, {
                    t: "address[]",
                    v: hotWallets
                }, false, 2);
                sigs = await createSigs(dataToSign, signees);
                await operator.addTrustedWallets(sigs.v, sigs.r, sigs.s, hotWallets, false)
                    .should.be.rejectedWith(EVMRevert);
            });
        });

        // Also cover the no fund added test case
        describe("when give a wallet of which the owner is not the fund", () => {
            it("should revert", async () => {
                let hotWallets = [(await FundWallet.new(operator.address, {from: sender})).address];
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddTrustedWallets, {
                    t: "address[]",
                    v: hotWallets
                }, false, 1);
                let sigs = await createSigs(dataToSign, signees);
                await operator.addTrustedWallets(sigs.v, sigs.r, sigs.s, hotWallets, false)
                    .should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when given valid wallet addresses", () => {

            describe("when given multiple hot wallets", () => {
                let wallets, sigs;

                beforeEach(async () => {
                    let wallet1 = await FundWallet.new(fund.address, {from: sender});
                    let wallet2 = await FundWallet.new(fund.address, {from: sender});
                    wallets = [wallet1.address, wallet2.address];
                    let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddTrustedWallets, {
                        t: "address[]",
                        v: wallets
                    }, true, 1);
                    sigs = await createSigs(dataToSign, signees);
                });

                it("should add the wallets correctly and increase the nonce", async () => {
                    await operator.addTrustedWallets(sigs.v, sigs.r, sigs.s, wallets, true);

                    (await operator.isHotWallet(wallets[0])).should.be.true;
                    (await operator.isTrustedWallet(wallets[0])).should.be.true;
                    (await operator.isHotWallet(wallets[1])).should.be.true;
                    (await operator.isTrustedWallet(wallets[1])).should.be.true;
                    (await operator.hotWallets(0)).should.equal(wallets[0]);
                    (await operator.hotWallets(1)).should.equal(wallets[1]);
                    (await operator.nonce()).should.be.bignumber.equal(2);
                });

                it("should emit events", async () => {
                    let {logs} = await operator.addTrustedWallets(sigs.v, sigs.r, sigs.s, wallets, true);

                    let hotEvents = logs.filter(e => e.event === "HotWalletAdded");
                    let trustEvent = logs.filter(e => e.event === "TrustedWalletAdded");
                    hotEvents.length.should.equal(2)
                    hotEvents[0].args.wallet.should.equal(wallets[0]);
                    hotEvents[1].args.wallet.should.equal(wallets[1]);
                    trustEvent.length.should.equal(2)
                    trustEvent[0].args.wallet.should.equal(wallets[0]);
                    trustEvent[1].args.wallet.should.equal(wallets[1]);
                });

            });

            describe("when given one hot wallet", () => {
                it("should add the wallet correctly", async () => {
                    let hotWallets = [(await FundWallet.new(fund.address, {from: sender})).address];
                    let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddTrustedWallets, {
                        t: "address[]",
                        v: hotWallets
                    }, true, 1);
                    let sigs = await createSigs(dataToSign, signees);
                    await operator.addTrustedWallets(sigs.v, sigs.r, sigs.s, hotWallets, true);

                    (await operator.isHotWallet(hotWallets[0])).should.be.true;
                    (await operator.isTrustedWallet(hotWallets[0])).should.be.true;
                    (await operator.hotWallets(0)).should.equal(hotWallets[0]);
                });
            });

            describe("when given one trusted wallet", () => {
                it("should not add a hot wallet and should not emit a hot event", async () => {
                    let trustWallets = [(await FundWallet.new(fund.address, {from: sender})).address];
                    let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddTrustedWallets, {
                        t: "address[]",
                        v: trustWallets
                    }, false, 1);
                    let sigs = await createSigs(dataToSign, signees);
                    let {logs} = await operator.addTrustedWallets(sigs.v, sigs.r, sigs.s, trustWallets, false);
                    let hotEvents = logs.filter(e => e.event === "HotWalletAdded");

                    (await operator.isHotWallet(trustWallets[0])).should.be.false;
                    hotEvents.length.should.equal(0);
                });
            });

        });
    });

    describe("addColdWallet", () => {
        let fund, sigs, wallet;

        beforeEach(async () => {
            fund = await Fund.new(operator.address, {from: sender});
            let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddFund, fund.address, 0);
            let sigs = await createSigs(dataToSign, signees);
            await operator.addFund(sigs.v, sigs.r, sigs.s, fund.address);
        });

        describe("when given wrong signatures", () => {
            it("should revert", async () => {
                wallet = await FundWallet.new(fund.address, {from: sender});
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddColdWallet, wallet.address,
                    coldKey, 1);
                sigs = await createSigs(dataToSign, signees);

                await operator.addColdWallet(sigs.v, sigs.r, sigs.s, wallet.address, coldKey)
                    .should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when given a wallet that is already a trusted wallet", () => {
            it("should revert", async () => {
                wallet = await FundWallet.new(fund.address, {from: sender});
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddTrustedWallets, {
                    t: "address[]",
                    v: [wallet.address]
                }, false, 1);
                let sigs = await createSigs(dataToSign, signees);
                await operator.addTrustedWallets(sigs.v, sigs.r, sigs.s, [wallet.address], false);

                dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddColdWallet, wallet.address,
                    coldKey, 2);
                sigs = await createSigs(dataToSign, signees.concat(coldKey));
                await operator.addColdWallet(sigs.v, sigs.r, sigs.s, wallet.address, coldKey)
                    .should.be.rejectedWith(EVMRevert);
            });
        });

        // Also cover the no fund added test case
        describe("when give a wallet of which the owner is not the fund", () => {
            it("should revert", async () => {
                wallet = await FundWallet.new(sender, {from: sender});
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddColdWallet, wallet.address,
                    coldKey, 1);
                sigs = await createSigs(dataToSign, signees.concat(coldKey));

                await operator.addColdWallet(sigs.v, sigs.r, sigs.s, wallet.address, coldKey)
                    .should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when given a valid address", () => {

            beforeEach(async () => {
                wallet = await FundWallet.new(fund.address, {from: sender});
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddColdWallet, wallet.address,
                    coldKey, 1);
                sigs = await createSigs(dataToSign, signees.concat(coldKey));
            });

            it("should add the wallet correctly and increase the nonce", async () => {
                await operator.addColdWallet(sigs.v, sigs.r, sigs.s, wallet.address, coldKey);

                (await operator.isTrustedWallet(wallet.address)).should.be.true;
                (await operator.coldWallets(0)).should.equal(wallet.address);
                (await operator.coldStorage(wallet.address)).should.equal(coldKey);
                (await operator.coldAccounts(0)).should.equal(coldKey);
                (await operator.nonce()).should.be.bignumber.equal(2);
            });

            it("should emit events", async () => {
                let {logs} = await operator.addColdWallet(sigs.v, sigs.r, sigs.s, wallet.address, coldKey);

                let coldEvent = logs.find(e => e.event === "ColdWalletAdded");
                let trustEvent = logs.find(e => e.event === "TrustedWalletAdded");
                coldEvent.args.wallet.should.equal(wallet.address);
                coldEvent.args.key.should.equal(coldKey);
                trustEvent.args.wallet.should.equal(wallet.address);
            });

        });

    });

    describe("requestEtherTransfer", () => {
        const initialBalance = ether(1);
        const amountToSend = ether(0.2);
        let fund, hotWalletFrom, hotWalletTo, sigs, nonce;


        // Creates Operator and adds Fund and HotWallets to it
        beforeEach(async () => {
            // Keeping track of nonce manually to speed up tests
            nonce = 0;
            fund = await Fund.new(operator.address, {from: sender});
            hotWalletFrom = await FundWallet.new(fund.address, {from: sender});
            hotWalletTo = await FundWallet.new(fund.address, {from: sender});

            let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddFund, fund.address, nonce++);
            sigs = await createSigs(dataToSign, signees);
            await operator.addFund(sigs.v, sigs.r, sigs.s, fund.address);

            let hotWallets = [hotWalletFrom.address, hotWalletTo.address];
            dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddTrustedWallets, {
                t: "address[]",
                v: hotWallets
            }, true, nonce++);
            sigs = await createSigs(dataToSign, signees);
            await operator.addTrustedWallets(sigs.v, sigs.r, sigs.s, hotWallets, true);
            await web3.eth.sendTransaction({from: sender, to: hotWalletFrom.address, value: initialBalance});
        });

        describe("when sending ether from a  trusted wallet to a trusted wallet", () => {
            it("should revert", async () => {
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddTrustedWallets, {
                    t: "address[]",
                    v: [externalW]
                }, false, nonce++);
                sigs = await createSigs(dataToSign, signees);
                // await operator.addTrustedWallets(sigs.v, sigs.r, sigs.s, [externalW], false);
                await web3.eth.sendTransaction({from: sender, to: externalW, value: initialBalance});
                dataToSign = Web3Utils.soliditySha3(operator.address, Actions.EtherTransfer, externalW,
                    hotWalletTo.address, amountToSend, nonce++);
                sigs = await createSigs(dataToSign, signees);
                await operator.requestEtherTransfer(sigs.v, sigs.r, sigs.s, externalW, hotWalletTo.address, amountToSend)
                    .should.be.rejectedWith(EVMRevert);
            });
        });


        describe("when sending ether from a hot wallet to a trusted wallet and giving only hotAcc sigs", () => {

            beforeEach(async () => {
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.EtherTransfer, hotWalletFrom.address,
                    hotWalletTo.address, amountToSend, nonce++);
                sigs = await createSigs(dataToSign, sortedHotAccounts.slice(0, 3));
            });

            describe("when trying to send more ether than available", () => {
                it("should revert", async () => {
                    await operator.requestEtherTransfer(sigs.v, sigs.r, sigs.s, hotWalletFrom.address, hotWalletTo.address, initialBalance.plus(1))
                        .should.be.rejectedWith(EVMRevert);
                });
            });

            describe("when given wrong signatures", () => {
                it("should revert", async () => {
                    await operator.requestEtherTransfer(sigs.v, sigs.r, sigs.r, hotWalletFrom.address, hotWalletTo.address, amountToSend)
                        .should.be.rejectedWith(EVMRevert);
                });
            });

            it("should send the ether correctly", async () => {
                const preWalletFromBal = await web3.eth.getBalance(hotWalletFrom.address);
                const preWalletToBal = await web3.eth.getBalance(hotWalletTo.address);

                await operator.requestEtherTransfer(sigs.v, sigs.r, sigs.s, hotWalletFrom.address, hotWalletTo.address, amountToSend);

                const postWalletFromBal = await web3.eth.getBalance(hotWalletFrom.address);
                const postWalletToBal = await web3.eth.getBalance(hotWalletTo.address);
                postWalletFromBal.should.be.bignumber.equal(preWalletFromBal.minus(amountToSend));
                postWalletToBal.should.be.bignumber.equal(preWalletToBal.plus(amountToSend));
            });

            it("should increase the nonce", async () => {
                const preNonce = await operator.nonce();

                await operator.requestEtherTransfer(sigs.v, sigs.r, sigs.s, hotWalletFrom.address, hotWalletTo.address, amountToSend);

                const postNonce = await operator.nonce();
                postNonce.should.be.bignumber.equal(preNonce.plus(1));
            });

            it("should emit events", async () => {
                const {logs} = await operator.requestEtherTransfer(sigs.v, sigs.r, sigs.s, hotWalletFrom.address, hotWalletTo.address, amountToSend);

                const event = logs.find(e => e.event === "EtherTransferAuthorized");
                logs.length.should.equal(1);
                event.args.from.should.equal(hotWalletFrom.address);
                event.args.to.should.equal(hotWalletTo.address);
                event.args.value.should.be.bignumber.equal(amountToSend);
            });

        });

        describe("when sending ether from a hot wallet to an unknown wallet", () => {

            describe("when only hotAccount signatures are given", () => {
                it("should revert", async () => {
                    let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.EtherTransfer, hotWalletFrom.address,
                        hotWalletTo.address, amountToSend, nonce);
                    sigs = await createSigs(dataToSign, sortedHotAccounts.slice(0, 3));
                    await operator.requestEtherTransfer(sigs.v, sigs.r, sigs.s, hotWalletFrom.address, externalW, amountToSend)
                        .should.be.rejectedWith(EVMRevert);
                });
            });

            describe("when hotAccount and trustparty signatures are given", () => {
                it("should send the ether correctly", async () => {
                    let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.EtherTransfer, hotWalletFrom.address,
                        externalW, amountToSend, nonce);
                    sigs = await createSigs(dataToSign, signees);

                    const preWalletFromBal = await web3.eth.getBalance(hotWalletFrom.address);
                    const preExternalBal = await web3.eth.getBalance(externalW);

                    await operator.requestEtherTransfer(sigs.v, sigs.r, sigs.s, hotWalletFrom.address, externalW, amountToSend);

                    const postWalletFromBal = await web3.eth.getBalance(hotWalletFrom.address);
                    const postExternalBal = await web3.eth.getBalance(externalW);
                    postWalletFromBal.should.be.bignumber.equal(preWalletFromBal.minus(amountToSend));
                    postExternalBal.should.be.bignumber.equal(preExternalBal.plus(amountToSend));
                });
            });

        });

        describe("when sending ether from a cold wallet to a trusted wallet", () => {
            let coldWallet;

            beforeEach(async () => {
                coldWallet = await FundWallet.new(fund.address, {from: sender});
                await web3.eth.sendTransaction({from: sender, to: coldWallet.address, value: initialBalance});
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddColdWallet, coldWallet.address,
                    coldKey, nonce++);
                sigs = await createSigs(dataToSign, signees.concat(coldKey));
                await operator.addColdWallet(sigs.v, sigs.r, sigs.s, coldWallet.address, coldKey);
            });

            describe("when not given a correct cold key", () => {
                it("should revert", async () => {
                    let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.EtherTransfer, coldWallet.address,
                        hotWalletTo.address, amountToSend, nonce++);
                    sigs = await createSigs(dataToSign, signees);
                    await operator.requestEtherTransfer(sigs.v, sigs.r, sigs.s, coldWallet.address, hotWalletTo.address, amountToSend)
                        .should.be.rejectedWith(EVMRevert);
                });
            });

            describe("when given the correct cold key", () => {
                it("should send the ether correctly", async () => {
                    let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.EtherTransfer, coldWallet.address,
                        hotWalletTo.address, amountToSend, nonce++);
                    sigs = await createSigs(dataToSign, signees.concat(coldKey));
                    const preColdBal = await web3.eth.getBalance(coldWallet.address);
                    const preReceiverBal = await web3.eth.getBalance(hotWalletTo.address);

                    await operator.requestEtherTransfer(sigs.v, sigs.r, sigs.s, coldWallet.address, hotWalletTo.address,
                        amountToSend);
                    (await web3.eth.getBalance(coldWallet.address)).should.be.bignumber
                        .equal(preColdBal.minus(amountToSend));
                    (await web3.eth.getBalance(hotWalletTo.address)).should.be.bignumber
                        .equal(preReceiverBal.plus(amountToSend));

                });

            });

        });

    });

    // Many negative test cases are covered in requestEtherTransfer because the use the same function for checking
    // Signatures
    describe("requestTokenTransfer", () => {
        const initialBalance = 100000;
        const tokensToSend = 100;
        let fund, hotWalletFrom, hotWalletTo, token, sigs, nonce;

        // Creates Operator and adds Fund and HotWallets to it
        beforeEach(async () => {
            // Keeping track of nonce manually to speed up tests
            nonce = 0;
            fund = await Fund.new(operator.address, {from: sender});
            hotWalletFrom = await FundWallet.new(fund.address, {from: sender});
            hotWalletTo = await FundWallet.new(fund.address, {from: sender});

            let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddFund, fund.address, nonce++);
            sigs = await createSigs(dataToSign, signees);
            await operator.addFund(sigs.v, sigs.r, sigs.s, fund.address);

            let hotWallets = [hotWalletFrom.address, hotWalletTo.address];
            dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddTrustedWallets, {
                t: "address[]",
                v: hotWallets
            }, true, nonce++);
            sigs = await createSigs(dataToSign, signees);
            await operator.addTrustedWallets(sigs.v, sigs.r, sigs.s, hotWallets, true);

            token = await SimpleToken.new({from: sender});
            await token.transfer(hotWalletFrom.address, initialBalance, {from: sender});
        });

        describe("when sending tokens from a hot wallet to a hot wallet", () => {

            describe("when trying to authorize more tokens than available", () => {
                it("should revert", async () => {
                    let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.TokenTransfer, token.address,
                        hotWalletFrom.address, hotWalletTo.address, initialBalance + 1, nonce++);
                    sigs = await createSigs(dataToSign, sortedHotAccounts);
                    await operator.requestTokenTransfer(sigs.v, sigs.r, sigs.s, token.address,
                        hotWalletFrom.address, hotWalletTo.address, initialBalance + 1)
                        .should.be.rejectedWith(EVMRevert);
                });
            });

            describe("when sending a valid amount", () => {

                beforeEach(async () => {
                    let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.TokenTransfer, token.address,
                        hotWalletFrom.address, hotWalletTo.address, tokensToSend, nonce++);
                    sigs = await createSigs(dataToSign, sortedHotAccounts);
                });

                it("should move the right amount of tokens and increase the nonce", async () => {
                    let preNonce = await operator.nonce();
                    await operator.requestTokenTransfer(sigs.v, sigs.r, sigs.s, token.address,
                        hotWalletFrom.address, hotWalletTo.address, tokensToSend);

                    (await token.balanceOf(hotWalletFrom.address)).should.be.bignumber.equal(initialBalance - tokensToSend);
                    (await token.balanceOf(hotWalletTo.address)).should.be.bignumber.equal(tokensToSend);
                    (await operator.nonce()).should.be.bignumber.equal(preNonce.plus(1));
                });

                it("should emit an event", async () => {
                    let {logs} = await operator.requestTokenTransfer(sigs.v, sigs.r, sigs.s, token.address,
                        hotWalletFrom.address, hotWalletTo.address, tokensToSend);

                    let event = logs.find(e => e.event === "TokenTransferAuthorized");
                    logs.length.should.equal(1);
                    event.args.token.should.equal(token.address);
                    event.args.from.should.equal(hotWalletFrom.address);
                    event.args.to.should.equal(hotWalletTo.address);
                    event.args.value.should.be.bignumber.equal(tokensToSend);
                });

            });

        });

    });

    describe("requestPriceUpdate", () => {
        let num = 3;
        let den = 7;
        let fund, sigs;

        beforeEach(async () => {
            fund = await Fund.new(operator.address, {from: sender});
            let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddFund, fund.address, 0);
            sigs = await createSigs(dataToSign, signees);
            await operator.addFund(sigs.v, sigs.r, sigs.s, fund.address);
            dataToSign = Web3Utils.soliditySha3(operator.address, Actions.UpdatePrice, num, den, 1);
            sigs = await createSigs(dataToSign, hotAccounts);
        });

        describe("when given valid price", () => {

            it("should update price and nonce", async () => {
                let preNonce = await operator.nonce();
                await operator.requestPriceUpdate(sigs.v, sigs.r, sigs.s, num, den);

                let price = await fund.currentPrice();
                price[0].should.be.bignumber.equal(num);
                price[1].should.be.bignumber.equal(den);
                (await operator.nonce()).should.be.bignumber.equal(preNonce.plus(1));
            });

            it("should emit an event", async () => {
                let {logs} = await operator.requestPriceUpdate(sigs.v, sigs.r, sigs.s, num, den);
                let event = logs.find(e => e.event === "PriceUpdateAuthorized");
                logs.length.should.equal(1);
                event.args.numerator.should.be.bignumber.equal(num);
                event.args.denominator.should.be.bignumber.equal(den);
            });

        });

    });

    describe("requestPause", () => {
        let fund, sigs;

        beforeEach(async () => {
            fund = await Fund.new(operator.address, {from: sender});
            let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.AddFund, fund.address, 0);
            sigs = await createSigs(dataToSign, signees);
            await operator.addFund(sigs.v, sigs.r, sigs.s, fund.address);
            dataToSign = Web3Utils.soliditySha3(operator.address, Actions.Pause, true, 1);
            sigs = await createSigs(dataToSign, signees);
        });

        describe("when pausing the fund", () => {

            describe("when given wrong signatures", () => {
                it("should revert", async () => {
                    await operator.requestPause(sigs.v, sigs.r, sigs.r, true)
                        .should.be.rejectedWith(EVMRevert);
                });
            });

            it("should pause the fund and increase the nonce", async () => {
                let preNonce = await operator.nonce();
                await operator.requestPause(sigs.v, sigs.r, sigs.s, true);

                (await operator.nonce()).should.be.bignumber.equal(preNonce.plus(1));
                (await fund.paused()).should.be.true;
            });

            it("should emit an event", async () => {
                let {logs} = await operator.requestPause(sigs.v, sigs.r, sigs.s, true);
                let event = logs.find(e => e.event === "PauseAuthorized");
                logs.length.should.equal(1);
                should.exist(event);
            });

        });

        describe("when unpausing a paused fund", () => {

            beforeEach(async () => {
                await operator.requestPause(sigs.v, sigs.r, sigs.s, true);
                let dataToSign = Web3Utils.soliditySha3(operator.address, Actions.Pause, false, 2);
                sigs = await createSigs(dataToSign, signees);
            });

            it("should unpause the fund", async () => {
                await operator.requestPause(sigs.v, sigs.r, sigs.s, false);
                (await fund.paused()).should.be.false;
            });

            it("should emit an event", async () => {
                let {logs} = await operator.requestPause(sigs.v, sigs.r, sigs.s, false);
                let event = logs.find(e => e.event === "UnpauseAuthorized");
                logs.length.should.equal(1);
                should.exist(event);
            });

        });

    });


});

let createSigs = async (dataToSign, accounts) => {
    let r = [], s = [], v = [];
    for (let i = 0; i < accounts.length; i++) {
        let signature = await web3.eth.sign(accounts[i], dataToSign);
        // First two bytes are 0x
        r.push("0x" + signature.slice(2, 66));
        s.push("0x" + signature.slice(66, 130));
        // In order to conform with ecrecover add 27
        v.push(web3.toDecimal(signature.slice(130, 132)) + 27);
    }

    return {v: v, r: r, s: s};
};


