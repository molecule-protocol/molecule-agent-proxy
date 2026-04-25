// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ValidationRegistry} from "../src/ValidationRegistry.sol";

contract ValidationRegistryTest is Test {
    ValidationRegistry registry;
    address validator = makeAddr("validator");

    function setUp() public {
        registry = new ValidationRegistry();
    }

    function test_record_appends_and_emits() public {
        bytes32 hash = keccak256("attestation");
        vm.expectEmit(true, true, true, true);
        emit ValidationRegistry.AttestationRecorded(7, hash, validator, uint64(block.timestamp));
        vm.prank(validator);
        registry.record(7, hash);

        assertEq(registry.recordCount(7), 1);
        ValidationRegistry.Record[] memory records = registry.getRecords(7);
        assertEq(records.length, 1);
        assertEq(records[0].attestationHash, hash);
        assertEq(records[0].validator, validator);
    }

    function test_record_multiple_attestations() public {
        vm.prank(validator);
        registry.record(7, keccak256("a"));
        vm.prank(validator);
        registry.record(7, keccak256("b"));
        assertEq(registry.recordCount(7), 2);
    }
}
