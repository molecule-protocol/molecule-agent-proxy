// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MoleculeVault — per-call USDC nano-payment routing for MAP
/// @notice Agents pay tiny USDC fees per upstream API call. Each call emits an
///         on-chain event the dashboard streams as the live TX feed.
contract MoleculeVault is Ownable {
    IERC20 public immutable usdc;
    address public protocolTreasury;
    uint64 public perCallFee; // USDC base units (6 decimals). 500 = $0.0005

    event Charged(
        uint256 indexed nftId,
        bytes32 indexed requestNonce,
        address indexed payer,
        uint64 fee,
        uint64 timestamp
    );
    event PerCallFeeUpdated(uint64 oldFee, uint64 newFee);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    error TransferFailed();

    constructor(address _usdc, address _treasury, uint64 _perCallFee) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        protocolTreasury = _treasury;
        perCallFee = _perCallFee;
    }

    /// @notice Pull `perCallFee` USDC from caller into the protocol treasury and
    ///         emit a Charged event. Caller must have approved this contract for USDC.
    /// @param nftId          The agent NFT making the call (for the live feed)
    /// @param requestNonce   Unique nonce per request (for the live feed; replay protection
    ///                       is enforced off-chain by the proxy backend)
    function chargeAndForward(uint256 nftId, bytes32 requestNonce) external {
        bool ok = usdc.transferFrom(msg.sender, protocolTreasury, perCallFee);
        if (!ok) revert TransferFailed();
        emit Charged(nftId, requestNonce, msg.sender, perCallFee, uint64(block.timestamp));
    }

    function setPerCallFee(uint64 newFee) external onlyOwner {
        emit PerCallFeeUpdated(perCallFee, newFee);
        perCallFee = newFee;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        emit TreasuryUpdated(protocolTreasury, newTreasury);
        protocolTreasury = newTreasury;
    }
}
