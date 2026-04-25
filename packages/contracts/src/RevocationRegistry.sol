// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title MAP Revocation Registry
/// @notice Binds an off-chain session key to an on-chain agent NFT + owner,
///         then lets the owner revoke the session key (kills further proxy access).
contract RevocationRegistry {
    struct Binding {
        uint256 nftId;
        address owner;     // msg.sender at bind time; must match for revoke
        uint64 boundAt;
        uint64 revokedAt;  // 0 = not revoked
    }

    mapping(address => Binding) public bindings;

    event Bound(address indexed sessionKey, uint256 indexed nftId, address indexed owner);
    event Revoked(address indexed sessionKey, address indexed by, uint64 timestamp);

    error AlreadyBound();
    error NotOwner();
    error AlreadyRevoked();
    error NotBound();

    function bind(address sessionKey, uint256 nftId) external {
        Binding storage b = bindings[sessionKey];
        if (b.owner != address(0)) revert AlreadyBound();
        b.nftId = nftId;
        b.owner = msg.sender;
        b.boundAt = uint64(block.timestamp);
        emit Bound(sessionKey, nftId, msg.sender);
    }

    function revoke(address sessionKey) external {
        Binding storage b = bindings[sessionKey];
        if (b.owner == address(0)) revert NotBound();
        if (b.owner != msg.sender) revert NotOwner();
        if (b.revokedAt != 0) revert AlreadyRevoked();
        b.revokedAt = uint64(block.timestamp);
        emit Revoked(sessionKey, msg.sender, b.revokedAt);
    }

    function getRevokedAt(address sessionKey) external view returns (uint64) {
        return bindings[sessionKey].revokedAt;
    }

    function isRevoked(address sessionKey) external view returns (bool) {
        return bindings[sessionKey].revokedAt != 0;
    }
}
