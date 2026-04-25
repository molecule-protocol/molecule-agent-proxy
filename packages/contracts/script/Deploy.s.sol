// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ValidationRegistry} from "../src/ValidationRegistry.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";
import {MoleculeVault} from "../src/MoleculeVault.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address treasury = vm.envAddress("PROTOCOL_TREASURY");
        uint64 perCallFee = uint64(vm.envOr("PER_CALL_FEE", uint256(500))); // 500 = $0.0005

        vm.startBroadcast(deployerPk);

        IdentityRegistry identity = new IdentityRegistry();
        ValidationRegistry validation = new ValidationRegistry();
        RevocationRegistry revocation = new RevocationRegistry();
        MoleculeVault vault = new MoleculeVault(usdc, treasury, perCallFee);

        vm.stopBroadcast();

        // Print addresses for capture into deployments/arc-testnet.json
        console2.log("IdentityRegistry:    ", address(identity));
        console2.log("ValidationRegistry:  ", address(validation));
        console2.log("RevocationRegistry:  ", address(revocation));
        console2.log("MoleculeVault:       ", address(vault));
        console2.log("USDC (used):         ", usdc);
        console2.log("Treasury:            ", treasury);
        console2.log("PerCallFee:          ", perCallFee);

        // Write addresses to deployments JSON
        string memory key = "deployment";
        vm.serializeAddress(key, "identityRegistry", address(identity));
        vm.serializeAddress(key, "validationRegistry", address(validation));
        vm.serializeAddress(key, "revocationRegistry", address(revocation));
        vm.serializeAddress(key, "moleculeVault", address(vault));
        vm.serializeAddress(key, "usdc", usdc);
        vm.serializeAddress(key, "treasury", treasury);
        vm.serializeUint(key, "perCallFee", perCallFee);
        vm.serializeUint(key, "chainId", block.chainid);
        string memory json = vm.serializeUint(key, "deployedAt", block.timestamp);

        vm.writeJson(json, "../../deployments/arc-testnet.json");
    }
}
