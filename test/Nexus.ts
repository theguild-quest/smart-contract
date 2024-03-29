import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ContractTransactionReceipt, Signer } from "ethers";
import { CreatedAccount, ERC6551Setup } from "./helpers/types";
import {
    ReferralHandlerERC6551Account,
    ProfileNFT,
    Nexus,
} from "../typechain-types";
import {
    fixture_nexus_unit_tests,
    full_integration_fixture,
} from "./helpers/fixtures";
import { parseEventLogs } from "./helpers/utils";
import { mockTokenSetup, selfDestructSetup } from "./helpers/setup";

describe("Nexus", function () {
    async function mockAccounts(): Promise<Signer[]> {
        const [owner, user1, user2, user3, user4, user5, user6] =
            await ethers.getSigners();

        return [owner, user1, user2, user3, user4, user5, user6];
    }

    async function fixture_unit_tests() {
        const accounts = await mockAccounts();
        return await fixture_nexus_unit_tests(accounts);
    }

    async function fixture_integration_tests() {
        const accounts = await mockAccounts();
        return await full_integration_fixture(accounts);
    }

    // Unit tests to test the Nexus contract
    describe("Unit Tests", function () {
        let nexus_: Nexus,
            erc6551_: ERC6551Setup,
            accounts_: Signer[],
            profileNFT_: ProfileNFT;

        it("Account and Registry contract should be added successfully", async function () {
            const { nexus, erc6551, accounts, profileNFT } = await loadFixture(
                fixture_unit_tests
            );

            const accountImplementation = await nexus.accountImplementation();

            expect(accountImplementation).to.not.equal(ethers.ZeroAddress);
            expect(accountImplementation).to.equal(erc6551.account.target);

            const accountRegistry = await nexus.Registry();

            expect(accountRegistry).to.not.equal(ethers.ZeroAddress);
            expect(accountRegistry).to.equal(erc6551.registry.target);

            nexus_ = nexus;
            erc6551_ = erc6551;
            accounts_ = accounts;
            profileNFT_ = profileNFT;
        });

        it("Only Master should be able to addHandlers manually", async function () {
            await expect(
                nexus_.connect(accounts_[1]).addHandler(ethers.ZeroAddress)
            ).to.be.revertedWith("only master");

            await nexus_.addHandler(await accounts_[0].getAddress());

            expect(await nexus_.isHandler(await accounts_[0].getAddress())).to
                .be.true;
        });

        it("Should not be able to notify tier upgrade unless the account is a handler", async function () {
            await expect(
                nexus_.connect(accounts_[1]).notifyTierUpdate(1, 2)
            ).to.be.revertedWith("only handler");
        });

        it("Should be able to notify tier upgrade if the account is a handler", async function () {
            expect(await nexus_.notifyTierUpdate(1, 2))
                .to.emit(nexus_, "LevelChange")
                .withArgs(await accounts_[0].getAddress(), 1, 2);
        });

        it("Only master should be able to change the master", async function () {
            await expect(
                nexus_
                    .connect(accounts_[1])
                    .setMaster(await accounts_[1].getAddress())
            ).to.be.revertedWith("only master");

            await nexus_.setMaster(await accounts_[1].getAddress());

            expect(await nexus_.master()).to.equal(
                await accounts_[1].getAddress()
            );
        });

        it("Only master should be able the set the guardian", async function () {
            await expect(
                nexus_
                    .connect(accounts_[0])
                    .setGuardian(await accounts_[1].getAddress())
            ).to.be.revertedWith("only master");

            await nexus_
                .connect(accounts_[1])
                .setGuardian(await accounts_[1].getAddress());

            expect(await nexus_.guardian()).to.equal(
                await accounts_[1].getAddress()
            );
        });

        it("Only master should be able to se the rewarder", async function () {
            await expect(
                nexus_
                    .connect(accounts_[0])
                    .setRewarder(await accounts_[1].getAddress())
            ).to.be.revertedWith("only master");

            await nexus_
                .connect(accounts_[1])
                .setRewarder(await accounts_[1].getAddress());

            expect(await nexus_.rewarder()).to.equal(
                await accounts_[1].getAddress()
            );
        });

        it("Only master should be able to set the NFT", async function () {
            await expect(
                nexus_
                    .connect(accounts_[0])
                    .setNFT(await accounts_[1].getAddress())
            ).to.be.revertedWith("only master");

            await nexus_.connect(accounts_[1]).setNFT(profileNFT_.target);

            expect(await nexus_.NFT()).to.equal(profileNFT_.target);
        });

        it("Only master should be able to set the account implementation", async function () {
            await expect(
                nexus_
                    .connect(accounts_[0])
                    .setAccountImpl(await accounts_[1].getAddress())
            ).to.be.revertedWith("only master");

            await nexus_
                .connect(accounts_[1])
                .setAccountImpl(ethers.ZeroAddress);

            expect(await nexus_.accountImplementation()).to.equal(
                ethers.ZeroAddress
            );

            // Swap back account implementation for creating profile later on
            await nexus_
                .connect(accounts_[1])
                .setAccountImpl(erc6551_.account.target);
        });

        it("Only master should be able to set the tax manager", async function () {
            await expect(
                nexus_
                    .connect(accounts_[0])
                    .setTaxManager(await accounts_[1].getAddress())
            ).to.be.revertedWith("only master");

            await nexus_
                .connect(accounts_[1])
                .setTaxManager(await accounts_[1].getAddress());

            expect(await nexus_.taxManager()).to.equal(
                await accounts_[1].getAddress()
            );
        });

        it("Only master should be able to set the tier manager", async function () {
            await expect(
                nexus_
                    .connect(accounts_[0])
                    .setTierManager(await accounts_[1].getAddress())
            ).to.be.revertedWith("only master");

            await nexus_
                .connect(accounts_[1])
                .setTierManager(await accounts_[1].getAddress());

            expect(await nexus_.tierManager()).to.equal(
                await accounts_[1].getAddress()
            );
        });

        it("Only master should be able to setRegistry", async function () {
            const registry = await nexus_.Registry();

            await expect(
                nexus_
                    .connect(accounts_[0])
                    .setRegistry(await accounts_[1].getAddress())
            ).to.be.revertedWith("only master");

            await nexus_
                .connect(accounts_[1])
                .setRegistry(await accounts_[1].getAddress());

            expect(await nexus_.Registry()).to.equal(
                await accounts_[1].getAddress()
            );

            // Change back the registry
            await nexus_.connect(accounts_[1]).setRegistry(registry);
        });

        it("Only master should be able to view the guardian", async function () {
            const guardian = await nexus_.connect(accounts_[1]).guardian();

            expect(guardian).to.equal(await accounts_[1].getAddress());
        });

        let newProfileIssued: CreatedAccount;

        it("Should be able to createProfile of a handler account that matches the registry", async function () {
            const handlerAddress = await nexus_
                .connect(accounts_[1])
                .createProfile(
                    0,
                    await accounts_[2].getAddress(),
                    "ProfileLinkGoesHere",
                    ethers.encodeBytes32String("0")
                );

            const receipt =
                (await handlerAddress.wait()) as ContractTransactionReceipt;

            expect(receipt).to.be.ok;

            const keys = ["nftId", "handlerAddress"];

            const newProfileIssuance = parseEventLogs(
                receipt.logs,
                nexus_.interface,
                "NewProfileIssuance",
                keys
            );

            expect(newProfileIssuance).to.be.ok;

            const account = await erc6551_.registry.account(
                erc6551_.account.target,
                ethers.encodeBytes32String("0"),
                43112,
                profileNFT_.target,
                1
            );

            expect(newProfileIssuance.nftId).to.equal(1);
            expect(newProfileIssuance.handlerAddress).to.equal(account);

            newProfileIssued = newProfileIssuance;
        });

        it("Shouldn't be able to createProfile if not a guardian", async function () {
            await expect(
                nexus_
                    .connect(accounts_[2])
                    .createProfile(
                        0,
                        await accounts_[2].getAddress(),
                        "ProfileLinkGoesHere",
                        ethers.encodeBytes32String("0")
                    )
            ).to.be.revertedWith("only guardian");
        });

        it("TokenId matches account handler mapping", async function () {
            let tokenIdHandlerMapping = await nexus_.getHandler(
                newProfileIssued.nftId
            );

            expect(tokenIdHandlerMapping).to.equal(
                newProfileIssued.handlerAddress
            );
        });
    });

    describe("Integration Tests", function () {
        let nexus_: Nexus,
            erc6551_: ERC6551Setup,
            accounts_: {
                owner: Signer;
                seeker: Signer;
                solver: Signer;
            },
            profileNFT_: ProfileNFT,
            createdAccounts: CreatedAccount[] = [];

        it("Able to create multiple accounts through create profile without any address clashing during creation", async function () {
            const { accounts, contracts } = await loadFixture(
                fixture_integration_tests
            );

            nexus_ = contracts.nexus;
            erc6551_ = contracts.erc6551;
            accounts_ = accounts;
            profileNFT_ = contracts.profileNFT;

            // Sets the guardian
            await nexus_.setGuardian(await accounts_.owner.getAddress());

            // Sets NFT
            await nexus_.setNFT(profileNFT_.target);

            for (let i = 1; i < 5; i++) {
                const handlerAddress = await nexus_
                    .connect(accounts_.owner)
                    .createProfile(
                        0,
                        await accounts_.seeker.getAddress(),
                        "ProfileLinkGoesHere",
                        ethers.encodeBytes32String("0")
                    );

                const receipt =
                    (await handlerAddress.wait()) as ContractTransactionReceipt;

                expect(receipt).to.be.ok;

                const keys = ["nftId", "handlerAddress"];

                const newProfileIssuance = parseEventLogs(
                    receipt.logs,
                    nexus_.interface,
                    "NewProfileIssuance",
                    keys
                );

                expect(newProfileIssuance).to.be.ok;

                createdAccounts.push(newProfileIssuance);
            }

            const accountLength = 5 - 1;
            const uniqueAccounts = new Set(
                createdAccounts.map((x) => x.handlerAddress)
            );
            const uniqueAccountsArray = [...uniqueAccounts];

            expect(uniqueAccountsArray.length).to.equal(accountLength);
        });

        it("Should be able to create another account which references the same address", async function () {
            const handlerAddress = await nexus_
                .connect(accounts_.owner)
                .createProfile(
                    0,
                    await accounts_.seeker.getAddress(),
                    "ProfileLinkGoesHere",
                    ethers.encodeBytes32String("0")
                );

            const receipt =
                (await handlerAddress.wait()) as ContractTransactionReceipt;

            expect(receipt).to.be.ok;

            const keys = ["nftId", "handlerAddress"];

            const newProfileIssuance = parseEventLogs(
                receipt.logs,
                nexus_.interface,
                "NewProfileIssuance",
                keys
            );

            expect(newProfileIssuance).to.be.ok;

            expect(
                createdAccounts.some(
                    (account) =>
                        account.handlerAddress ===
                        newProfileIssuance.handlerAddress
                )
            ).to.be.false;

            createdAccounts.push(newProfileIssuance);
        });

        it("Accounts cannot use it's own ID as a referrer", async function () {
            await expect(
                nexus_.connect(accounts_.owner).createProfile(
                    createdAccounts.length + 1, // This value should be the newest mintable nft ID that is not in the createdAccounts array
                    await accounts_.seeker.getAddress(),
                    "ProfileLinkGoesHere",
                    ethers.encodeBytes32String("0")
                )
            ).to.be.revertedWith("Cannot be its own referrer");
        });

        it("Accounts should not be able to use an NFT Id which has not been minted as a referrer", async function () {
            await expect(
                nexus_
                    .connect(accounts_.owner)
                    .createProfile(
                        999,
                        await accounts_.seeker.getAddress(),
                        "ProfileLinkGoesHere",
                        ethers.encodeBytes32String("0")
                    )
            ).to.be.revertedWith("Referrer should have a valid profile id");
        });

        let depth1Account: ReferralHandlerERC6551Account,
            depth2Account: ReferralHandlerERC6551Account,
            depth3Account: ReferralHandlerERC6551Account,
            depth4Account: ReferralHandlerERC6551Account;

        it("Creating an account with a referral should add a handler as tier 1 to the referrer's referral tree", async function () {
            const handlerAddress = await nexus_
                .connect(accounts_.owner)
                .createProfile(
                    1,
                    await accounts_.seeker.getAddress(),
                    "ProfileLinkGoesHere",
                    ethers.encodeBytes32String("0")
                );

            const receipt =
                (await handlerAddress.wait()) as ContractTransactionReceipt;

            expect(receipt).to.be.ok;

            const keys = ["nftId", "handlerAddress"];

            const newProfileIssuance = parseEventLogs(
                receipt.logs,
                nexus_.interface,
                "NewProfileIssuance",
                keys
            );

            expect(newProfileIssuance).to.be.ok;

            createdAccounts.push(newProfileIssuance);

            const referredAccount = erc6551_.account.attach(
                createdAccounts[0].handlerAddress
            ) as ReferralHandlerERC6551Account;

            const tierCounts = await referredAccount.getTierCounts();

            expect(tierCounts).to.deep.equal([1n, 0n, 0n, 0n, 0n]);

            const newProfileAccount = erc6551_.account.attach(
                newProfileIssuance.handlerAddress
            ) as ReferralHandlerERC6551Account;

            depth1Account = newProfileAccount;

            const referrer = await newProfileAccount.referredBy();

            expect(referrer).to.equal(referredAccount.target);
        });

        it("Should be able to create an account with depthRef of 2 and update referral trees", async function () {
            const handlerAddress = await nexus_
                .connect(accounts_.owner)
                .createProfile(
                    await depth1Account.getNftId(),
                    await accounts_.seeker.getAddress(),
                    "ProfileLinkGoesHere",
                    ethers.encodeBytes32String("0")
                );

            const receipt =
                (await handlerAddress.wait()) as ContractTransactionReceipt;

            expect(receipt).to.be.ok;

            const keys = ["nftId", "handlerAddress"];

            const newProfileIssuance = parseEventLogs(
                receipt.logs,
                nexus_.interface,
                "NewProfileIssuance",
                keys
            );

            expect(newProfileIssuance).to.be.ok;

            createdAccounts.push(newProfileIssuance);

            // 2nd Depth Referrer
            let referredAccount = erc6551_.account.attach(
                createdAccounts[0].handlerAddress
            ) as ReferralHandlerERC6551Account;

            let tierCounts = await referredAccount.getTierCounts();

            expect(tierCounts).to.deep.equal([2n, 0n, 0n, 0n, 0n]);

            // 1st Depth Referrer
            tierCounts = await depth1Account.getTierCounts();

            expect(tierCounts).to.deep.equal([1n, 0n, 0n, 0n, 0n]);

            const newProfileAccount = erc6551_.account.attach(
                newProfileIssuance.handlerAddress
            ) as ReferralHandlerERC6551Account;

            depth2Account = newProfileAccount;

            const referrer = await newProfileAccount.referredBy();

            expect(referrer).to.equal(depth1Account.target);
        });

        it("Should be able to create an account with depthRef of 3 and update referral trees", async function () {
            const handlerAddress = await nexus_
                .connect(accounts_.owner)
                .createProfile(
                    await depth2Account.getNftId(),
                    await accounts_.seeker.getAddress(),
                    "ProfileLinkGoesHere",
                    ethers.encodeBytes32String("0")
                );

            const receipt =
                (await handlerAddress.wait()) as ContractTransactionReceipt;

            expect(receipt).to.be.ok;

            const keys = ["nftId", "handlerAddress"];

            const newProfileIssuance = parseEventLogs(
                receipt.logs,
                nexus_.interface,
                "NewProfileIssuance",
                keys
            );

            expect(newProfileIssuance).to.be.ok;

            createdAccounts.push(newProfileIssuance);

            // 3rd Depth Referrer
            let referredAccount = erc6551_.account.attach(
                createdAccounts[0].handlerAddress
            ) as ReferralHandlerERC6551Account;

            let tierCounts = await referredAccount.getTierCounts();

            expect(tierCounts).to.deep.equal([3n, 0n, 0n, 0n, 0n]);

            // 2nd Depth Referrer
            tierCounts = await depth1Account.getTierCounts();

            expect(tierCounts).to.deep.equal([2n, 0n, 0n, 0n, 0n]);

            // 1st Depth Referrer
            tierCounts = await depth2Account.getTierCounts();

            expect(tierCounts).to.deep.equal([1n, 0n, 0n, 0n, 0n]);

            const newProfileAccount = erc6551_.account.attach(
                newProfileIssuance.handlerAddress
            ) as ReferralHandlerERC6551Account;

            depth3Account = newProfileAccount;

            const referrer = await newProfileAccount.referredBy();

            expect(referrer).to.equal(depth2Account.target);
        });

        it("Should be able to create an account with depthRef of 4 and update referral trees", async function () {
            const handlerAddress = await nexus_
                .connect(accounts_.owner)
                .createProfile(
                    await depth3Account.getNftId(),
                    await accounts_.seeker.getAddress(),
                    "ProfileLinkGoesHere",
                    ethers.encodeBytes32String("0")
                );

            const receipt =
                (await handlerAddress.wait()) as ContractTransactionReceipt;

            expect(receipt).to.be.ok;

            const keys = ["nftId", "handlerAddress"];

            const newProfileIssuance = parseEventLogs(
                receipt.logs,
                nexus_.interface,
                "NewProfileIssuance",
                keys
            );

            expect(newProfileIssuance).to.be.ok;

            createdAccounts.push(newProfileIssuance);

            // 4th Depth Referrer
            let referredAccount = erc6551_.account.attach(
                createdAccounts[0].handlerAddress
            ) as ReferralHandlerERC6551Account;

            let tierCounts = await referredAccount.getTierCounts();

            expect(tierCounts).to.deep.equal([4n, 0n, 0n, 0n, 0n]);

            // 3rd Depth Referrer
            tierCounts = await depth1Account.getTierCounts();

            expect(tierCounts).to.deep.equal([3n, 0n, 0n, 0n, 0n]);

            // 2nd Depth Referrer
            tierCounts = await depth2Account.getTierCounts();

            expect(tierCounts).to.deep.equal([2n, 0n, 0n, 0n, 0n]);

            // 1st Depth Referrer
            tierCounts = await depth3Account.getTierCounts();

            expect(tierCounts).to.deep.equal([1n, 0n, 0n, 0n, 0n]);

            const newProfileAccount = erc6551_.account.attach(
                newProfileIssuance.handlerAddress
            ) as ReferralHandlerERC6551Account;

            depth4Account = newProfileAccount;

            const referrer = await newProfileAccount.referredBy();

            expect(referrer).to.equal(depth3Account.target);
        });

        it("Should not be updating accounts that are at 5 DepthRef or more", async function () {
            const handlerAddress = await nexus_
                .connect(accounts_.owner)
                .createProfile(
                    await depth4Account.getNftId(),
                    await accounts_.seeker.getAddress(),
                    "ProfileLinkGoesHere",
                    ethers.encodeBytes32String("0")
                );

            const receipt =
                (await handlerAddress.wait()) as ContractTransactionReceipt;

            expect(receipt).to.be.ok;

            const keys = ["nftId", "handlerAddress"];

            const newProfileIssuance = parseEventLogs(
                receipt.logs,
                nexus_.interface,
                "NewProfileIssuance",
                keys
            );

            expect(newProfileIssuance).to.be.ok;

            createdAccounts.push(newProfileIssuance);

            // 5th Depth Referrer
            let referredAccount = erc6551_.account.attach(
                createdAccounts[0].handlerAddress
            ) as ReferralHandlerERC6551Account;

            let tierCounts = await referredAccount.getTierCounts();

            expect(tierCounts).to.deep.equal([4n, 0n, 0n, 0n, 0n]);

            // 4rd Depth Referrer
            tierCounts = await depth1Account.getTierCounts();

            expect(tierCounts).to.deep.equal([4n, 0n, 0n, 0n, 0n]);

            // 3nd Depth Referrer
            tierCounts = await depth2Account.getTierCounts();

            expect(tierCounts).to.deep.equal([3n, 0n, 0n, 0n, 0n]);

            // 2st Depth Referrer
            tierCounts = await depth3Account.getTierCounts();

            expect(tierCounts).to.deep.equal([2n, 0n, 0n, 0n, 0n]);

            // 1st Depth Referrer
            tierCounts = await depth4Account.getTierCounts();

            expect(tierCounts).to.deep.equal([1n, 0n, 0n, 0n, 0n]);

            const newProfileAccount = erc6551_.account.attach(
                newProfileIssuance.handlerAddress
            ) as ReferralHandlerERC6551Account;

            const referrer = await newProfileAccount.referredBy();

            expect(referrer).to.equal(depth4Account.target);
        });

        it("Only master should be able to recoverTokens native", async function () {
            await expect(
                nexus_
                    .connect(accounts_.seeker)
                    .recoverTokens(
                        ethers.ZeroAddress,
                        await accounts_.seeker.getAddress()
                    )
            ).to.be.revertedWith("only master");

            const selfDestruct = await selfDestructSetup(true);

            // Transfer eth to tierManager
            await accounts_.solver.sendTransaction({
                to: selfDestruct.target,
                value: ethers.parseEther("1.0"),
            });

            await selfDestruct.sendEther(nexus_.target);

            expect(await ethers.provider.getBalance(nexus_.target)).to.equal(
                ethers.parseEther("1.0")
            );

            const balanceBefore = await ethers.provider.getBalance(
                await accounts_.solver.getAddress()
            );

            await nexus_.recoverTokens(
                ethers.ZeroAddress,
                await accounts_.solver.getAddress()
            );

            const balanceAfter = await ethers.provider.getBalance(
                await accounts_.solver.getAddress()
            );

            expect(balanceAfter - balanceBefore).to.equal(
                ethers.parseEther("1.0")
            );
        });

        it("Only master should be able to recoverTokens erc20", async function () {
            const mockToken = await mockTokenSetup(
                "mockToken",
                "mToken",
                18,
                true
            );

            await mockToken.mint(nexus_.target, 1000);

            expect(await mockToken.balanceOf(nexus_.target)).to.equal(1000);

            await nexus_.recoverTokens(
                mockToken.target,
                await accounts_.solver.getAddress()
            );

            expect(
                await mockToken.balanceOf(await accounts_.solver.getAddress())
            ).to.equal(1000);
        });
    });
});
