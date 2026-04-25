// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title MAP Identity Registry — ERC-8004 compatible
/// @notice One NFT per agent. tokenURI points to off-chain agent card JSON.
contract IdentityRegistry is ERC721URIStorage {
    uint256 public nextId = 1;

    event AgentMinted(uint256 indexed tokenId, address indexed owner, string tokenURI);

    constructor() ERC721("Molecule Agent Passport", "MAP") {}

    function mint(address to, string calldata uri) external returns (uint256 tokenId) {
        tokenId = nextId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        emit AgentMinted(tokenId, to, uri);
    }
}
