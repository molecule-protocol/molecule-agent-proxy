// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title MAP Validation Registry — ERC-8004 compatible
/// @notice Records attestation hashes per agent NFT (Reclaim ZK proof bindings).
contract ValidationRegistry {
    struct Record {
        bytes32 attestationHash;
        address validator;
        uint64 recordedAt;
    }

    /// @dev nftId => list of recorded validations
    mapping(uint256 => Record[]) private _records;

    event AttestationRecorded(
        uint256 indexed nftId,
        bytes32 indexed attestationHash,
        address indexed validator,
        uint64 recordedAt
    );

    function record(uint256 nftId, bytes32 attestationHash) external {
        _records[nftId].push(
            Record({
                attestationHash: attestationHash,
                validator: msg.sender,
                recordedAt: uint64(block.timestamp)
            })
        );
        emit AttestationRecorded(nftId, attestationHash, msg.sender, uint64(block.timestamp));
    }

    function getRecords(uint256 nftId) external view returns (Record[] memory) {
        return _records[nftId];
    }

    function recordCount(uint256 nftId) external view returns (uint256) {
        return _records[nftId].length;
    }
}
