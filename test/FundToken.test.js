import EVMRevert from "./open-zeppelin/helpers/EVMRevert";

const BigNumber = web3.BigNumber;

const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const FundToken = artifacts.require("FundToken");

contract("FundToken", ([sender, owner]) => {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    let token;

    beforeEach(async () => {
        token = await FundToken.new(owner, {from: sender});
    });

    describe("initialization", () => {

        it("should have a name", async () => {
            const name = await token.name();
            name.should.equal("FundToken");
        });

        it("should have a symbol", async () => {
            const symbol = await token.symbol();
            symbol.should.equal("FND");
        });

        it("should have 18 decimals", async () => {
            const decimals = await token.decimals();
            decimals.should.be.bignumber.equal("18");
        });

        it("should have a total supply of 0", async () => {
            const totalSupply = await token.totalSupply();
            totalSupply.should.be.bignumber.equal(0);
        });

        it("should have an owner", async () => {
            const owner_ = await token.owner();
            owner_.should.equal(owner);
        });

    });

    describe("burn", () => {
        const initialTokens = 100;

        beforeEach(async () => {
            await token.mint(owner, initialTokens, {from: owner});
        });

        describe("when the sender is not the owner", () => {
            it("should revert", async () => {
                await token.burn(owner, 50, {from: sender}).should.be.rejectedWith(EVMRevert);
            });
        });

        describe("when the sender is the owner", () => {

            describe("when trying to burn more tokens than the address has", () => {
                it("should revert", async () => {
                    await token.burn(owner, 101, {from: owner}).should.be.rejectedWith(EVMRevert);
                });
            });

            describe("when trying to burn all of the tokens an address has", () => {
                it("should burn all tokens", async () => {
                    await token.burn(owner, initialTokens, {from: owner});
                    const balance = await token.balanceOf(owner);
                    const totalSupply = await token.totalSupply();

                    balance.should.be.bignumber.equal(0);
                    totalSupply.should.be.bignumber.equal(0);
                });
            });

            describe("when trying to burn less tokens than an address has", () => {
                const amountBurned = 50;

                describe("when trying to burn from the zero address", () => {
                    it("should revert", async () => {
                        await token.mint(ZERO_ADDRESS, initialTokens, {from: owner});
                        await token.burn(ZERO_ADDRESS, amountBurned, {from: owner}).should.be.rejectedWith(EVMRevert);
                    });
                });

                it("should burn the correct amount", async () => {
                    await token.burn(owner, amountBurned, {from: owner});
                    const balance = await token.balanceOf(owner);
                    const totalSupply = await token.totalSupply();

                    balance.should.be.bignumber.equal(initialTokens - amountBurned);
                    totalSupply.should.be.bignumber.equal(initialTokens - amountBurned);
                });

                it("should emit a burn and a transfer event", async () => {
                    const {logs} = await token.burn(owner, amountBurned, {from: owner});
                    const burnEvent = logs.find(e => e.event === "Burn");
                    const transferEvent = logs.find(e => e.event === "Transfer");

                    logs.length.should.equal(2);

                    should.exist(burnEvent);
                    burnEvent.args.from.should.equal(owner);
                    burnEvent.args.value.should.be.bignumber.equal(amountBurned);

                    should.exist(transferEvent);
                    transferEvent.args.from.should.equal(owner);
                    transferEvent.args.to.should.equal(ZERO_ADDRESS);
                    transferEvent.args.value.should.be.bignumber.equal(amountBurned);
                });

            });

        });

    });

});
