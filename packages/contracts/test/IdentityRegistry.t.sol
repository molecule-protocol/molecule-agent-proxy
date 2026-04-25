// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";

contract IdentityRegistryTest is Test {
    IdentityRegistry registry;
    address owner = makeAddr("owner");

    function setUp() public {
        registry = new IdentityRegistry();
    }

    function test_mint_increments_id_and_assigns_owner() public {
        uint256 id1 = registry.mint(owner, "ipfs://agent-1");
        uint256 id2 = registry.mint(owner, "ipfs://agent-2");
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(registry.ownerOf(id1), owner);
        assertEq(registry.tokenURI(id2), "ipfs://agent-2");
    }

    function test_mint_emits_event() public {
        vm.expectEmit(true, true, false, true);
        emit IdentityRegistry.AgentMinted(1, owner, "ipfs://x");
        registry.mint(owner, "ipfs://x");
    }
}
