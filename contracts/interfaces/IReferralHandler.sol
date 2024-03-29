// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.20;

interface IReferralHandler {
    function initialize(
        address _referredBy
    ) external;
    function setTier(uint8 _tier) external;
    function checkReferralExistence(uint8 refDepth, address referralHandler) view external returns (uint8 _tier);
    function getNftId() external view returns (uint32 nftId);
    function getNft() external view returns (address nftContract);
    function referredBy() external view returns (address referrerHandler);
    function owner() external view returns (address owner);
    function getTier() external view returns (uint8 _tier);
    function updateReferralTree(uint8 refDepth) external;
    function addToReferralTree(uint8 refDepth, address referralHandler , uint8 _tier) external;
}