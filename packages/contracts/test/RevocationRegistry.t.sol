// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";

contract RevocationRegistryTest is Test {
    RevocationRegistry registry;
    address owner = makeAddr("owner");
    address attacker = makeAddr("attacker");
    address sessionKey = makeAddr("sessionKey");

    function setUp() public {
        registry = new RevocationRegistry();
    }

    function test_bind_sets_owner_and_nft() public {
        vm.prank(owner);
        registry.bind(sessionKey, 7);
        (uint256 nftId, address boundOwner, , uint64 revokedAt) = registry.bindings(sessionKey);
        assertEq(nftId, 7);
        assertEq(boundOwner, owner);
        assertEq(revokedAt, 0);
    }

    function test_bind_emits_event() public {
        vm.expectEmit(true, true, true, true);
        emit RevocationRegistry.Bound(sessionKey, 7, owner);
        vm.prank(owner);
        registry.bind(sessionKey, 7);
    }

    function test_bind_reverts_if_already_bound() public {
        vm.prank(owner);
        registry.bind(sessionKey, 7);
        vm.prank(owner);
        vm.expectRevert(RevocationRegistry.AlreadyBound.selector);
        registry.bind(sessionKey, 8);
    }

    function test_revoke_only_owner() public {
        vm.prank(owner);
        registry.bind(sessionKey, 7);
        vm.prank(attacker);
        vm.expectRevert(RevocationRegistry.NotOwner.selector);
        registry.revoke(sessionKey);
        assertFalse(registry.isRevoked(sessionKey));
    }

    function test_revoke_sets_timestamp_and_emits() public {
        vm.prank(owner);
        registry.bind(sessionKey, 7);
        vm.expectEmit(true, true, true, true);
        emit RevocationRegistry.Revoked(sessionKey, owner, uint64(block.timestamp));
        vm.prank(owner);
        registry.revoke(sessionKey);
        assertTrue(registry.isRevoked(sessionKey));
        assertEq(registry.getRevokedAt(sessionKey), uint64(block.timestamp));
    }

    function test_revoke_reverts_if_not_bound() public {
        vm.prank(owner);
        vm.expectRevert(RevocationRegistry.NotBound.selector);
        registry.revoke(sessionKey);
    }

    function test_revoke_reverts_if_already_revoked() public {
        vm.prank(owner);
        registry.bind(sessionKey, 7);
        vm.prank(owner);
        registry.revoke(sessionKey);
        vm.prank(owner);
        vm.expectRevert(RevocationRegistry.AlreadyRevoked.selector);
        registry.revoke(sessionKey);
    }
}
