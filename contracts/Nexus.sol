// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.20;

import "./interfaces/IProfileNFT.sol";
import "./interfaces/IReferralHandler.sol";
import "./interfaces/IERC6551/IERC6551Registry.sol";
import "./interfaces/IReferralHandler.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/INexus.sol";  

/**
 * @title Nexus contract
 * @author @cosmodude
 * @notice Core contract of the Referral system
 * @dev Creates accounts, updates referral tree and gives info about TaxManager, TierManager and Rewarder 
 */
contract Nexus is INexus {
    address public master; 
    address public guardian; 

    address public tierManager;
    address public taxManager;
    address public accountImplementation;
    address public rewarder;

    mapping(uint32 => address) NFTToHandler;
    mapping(address => uint32) HandlerToNFT;
    mapping(address => bool) handlerStorage;
    IProfileNFT public NFT;
    IERC6551Registry public Registry;

    // Set events
    event NewMaster(address oldMaster, address newMaster);
    event NewGuardian(address oldGuardian, address newGuardian);
    event NewRewarder(address oldRewarder, address newRewarder);
    event NewNFT(address oldNFT, address newNFT);
    event NewAccountImpl(address oldAcc, address newAcc);
    event NewTaxManager(address oldTaxManager, address newTaxManager);
    event NewTierManager(address oldTierManager, address newTierManager);
    event NewRegistry(address oldRegistry, address newRegistry);

    event NewProfileIssuance(uint32 id, address account);
    event LevelChange(address handler, uint8 oldTier, uint8 newTier);

    event SelfTaxClaimed(
        address indexed handler,
        uint256 amount,
        uint256 timestamp
    );

    event RewardClaimed(
        address indexed handler,
        uint256 amount,
        uint256 timestamp
    );

// check events
    modifier onlyMaster() {
        require(msg.sender == master, "only master");
        _;
    }

    modifier onlyGuardian() {
        require(msg.sender == guardian, "only guardian");
        _;
    }

    constructor(
        address _accountImplementation,
        address _registry
    ) {
        master = msg.sender;
        accountImplementation = _accountImplementation;
        Registry = IERC6551Registry(_registry);
    }

    function getProfileNFT() external view returns (address) {
        return address(NFT);
    }

    function getHandler(uint32 tokenID) external view returns (address) {
        return NFTToHandler[tokenID];
    }

    function isHandler(address _handler) public view returns (bool) {
        return handlerStorage[_handler];
    }

    function addHandler(address _handler) public onlyMaster {
        handlerStorage[_handler] = true;
    }

    function notifyTierUpdate(uint8 oldTier, uint8 newTier) external {
        // All the handlers notify the Factory incase there is a change in levels
        require(isHandler(msg.sender), "only handler");
        emit LevelChange(msg.sender, oldTier, newTier);
    }

    function setMaster(address newMaster) public onlyMaster {
        require(newMaster != address(0), "Setting master to 0 address");
        address oldMaster = master;
        master = newMaster;
        emit NewMaster(oldMaster, master);
    }

    function setGuardian(address newGuardian) public onlyMaster {
        address oldGuardian = guardian;
        guardian = newGuardian;
        emit NewGuardian(oldGuardian, newGuardian);
    }

    function setRewarder(address _rewarder) public onlyMaster {
        address oldRewarder = rewarder;
        rewarder = _rewarder;
        emit NewRewarder(oldRewarder, _rewarder);
    }

    function setNFT(address _NFT) external onlyMaster {
        address oldNFT = address(NFT);
        NFT = IProfileNFT(_NFT); // Set address of the NFT contract
        emit NewNFT(oldNFT, _NFT);
    }

    function setAccountImpl(address _acc) external onlyMaster {
        address oldAcc = address(accountImplementation);
        accountImplementation = _acc; // Set address of the account implementation contract
        emit NewAccountImpl(oldAcc, _acc);
    }

    function setTaxManager(address _taxManager) external onlyMaster {
        address oldManager = taxManager;
        taxManager = _taxManager;
        emit NewTaxManager(oldManager, _taxManager);
    }

    function setTierManager(address _tierManager) external onlyMaster {
        address oldManager = tierManager;
        tierManager = _tierManager;
        emit NewTierManager(oldManager, _tierManager);
    }

    function setRegistry(address _registry) external onlyMaster {
        address oldRegistry = address(Registry);
        Registry = IERC6551Registry(_registry);
        emit NewRegistry(oldRegistry, address(Registry));
    }

    function createProfile(uint32 referrerId, address recipient, string memory profileLink, bytes32 _salt) external onlyGuardian returns (address) {
        uint32 nftId = NFT.issueProfile(recipient, profileLink); 
        require(nftId!= referrerId, "Cannot be its own referrer");
        require(
            referrerId < nftId,  // 0 in case of no referrer
            "Referrer should have a valid profile id"
        );

        address handlerAd = Registry.createAccount(accountImplementation, _salt, block.chainid, address(NFT), nftId);
        NFTToHandler[nftId] = handlerAd;
        HandlerToNFT[handlerAd] = nftId;
        handlerStorage[handlerAd] = true;

        address referrerHandler = NFTToHandler[referrerId];
        
        IReferralHandler Handler = IReferralHandler(handlerAd);
        emit NewProfileIssuance(nftId, handlerAd);

        Handler.initialize(referrerHandler);
        addToReferrersAbove(1, handlerAd);

        return handlerAd;
    }

    /**
     * 
     * @param _tier  Tier of the profile
     * @param _handler Address of the handler for the newly created profile
     */
    function addToReferrersAbove(uint8 _tier, address _handler) internal {  // handler of the newly created profile
        // maybe rewritten id -> address (handler of the referrer)  ;; done
        address firstRef = IReferralHandler(_handler).referredBy();
        if ( firstRef != address(0)) {
            IReferralHandler(firstRef).addToReferralTree(
                1,
                _handler,
                _tier
            );
            address secondRef = IReferralHandler(firstRef).referredBy();
            if (secondRef!= address(0)) {
                IReferralHandler(secondRef).addToReferralTree(
                    2,
                    _handler,
                    _tier
                );
                address thirdRef = IReferralHandler(secondRef).referredBy();
                if (thirdRef != address(0)) {
                    IReferralHandler(thirdRef).addToReferralTree(
                        3,
                        _handler,
                        _tier
                    );
                    address fourthRef = IReferralHandler(thirdRef).referredBy();
                    if (fourthRef != address(0)) {
                        IReferralHandler(fourthRef).addToReferralTree(
                            4,
                            _handler,
                            _tier
                        );
                    }
                }
            }
        }
    }

    function recoverTokens(
        address _token,
        address benefactor
    ) external onlyMaster {
        if (_token == address(0)) {
            (bool sent, ) = payable(benefactor).call{
                value: address(this).balance
            }("");
            require(sent, "Send error");
            return;
        }
        uint256 tokenBalance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).transfer(benefactor, tokenBalance);
        return;
    }
}