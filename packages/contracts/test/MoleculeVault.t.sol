// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MoleculeVault} from "../src/MoleculeVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Tiny USDC stand-in for tests
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 1_000_000 * 1e6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mintTo(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MoleculeVaultTest is Test {
    MockUSDC usdc;
    MoleculeVault vault;
    address treasury = makeAddr("treasury");
    address agent = makeAddr("agent");
    uint64 constant FEE = 500; // $0.0005

    function setUp() public {
        usdc = new MockUSDC();
        vault = new MoleculeVault(address(usdc), treasury, FEE);
        usdc.mintTo(agent, 1_000_000); // $1.00 of USDC
        vm.prank(agent);
        usdc.approve(address(vault), type(uint256).max);
    }

    function test_chargeAndForward_pullsAndForwards() public {
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 agentBefore = usdc.balanceOf(agent);
        vm.prank(agent);
        vault.chargeAndForward(1, keccak256("nonce-1"));
        assertEq(usdc.balanceOf(treasury), treasuryBefore + FEE, "treasury credited");
        assertEq(usdc.balanceOf(agent), agentBefore - FEE, "agent debited");
    }

    function test_chargeAndForward_emitsEvent() public {
        bytes32 nonce = keccak256("nonce-x");
        vm.expectEmit(true, true, true, true);
        emit MoleculeVault.Charged(42, nonce, agent, FEE, uint64(block.timestamp));
        vm.prank(agent);
        vault.chargeAndForward(42, nonce);
    }

    function test_setPerCallFee_onlyOwner() public {
        vm.prank(agent);
        vm.expectRevert();
        vault.setPerCallFee(1000);
        vault.setPerCallFee(1000);
        assertEq(vault.perCallFee(), 1000);
    }

    function test_chargeAndForward_revertsWithoutAllowance() public {
        address brokeAgent = makeAddr("broke");
        usdc.mintTo(brokeAgent, FEE);
        vm.prank(brokeAgent);
        vm.expectRevert();
        vault.chargeAndForward(1, keccak256("x"));
    }
}
