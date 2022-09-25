"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("hardhat/config");
const abi2solidity_1 = __importDefault(require("abi2solidity"));
const fs_1 = __importDefault(require("fs"));
config_1.task("gen-interface", "Generate a new Solidity interface for a given file")
    .addPositionalParam("contract", "Solidity contract name")
    .setAction(async ({ contract }, hre) => {
    const artifact = await hre.artifacts.readArtifact(contract);
    const outputFile = hre.config.paths.root
        + '/'
        + artifact.sourceName.replace(/[^\/]+.sol/, `I${contract}.sol`);
    const solidity = abi2solidity_1.default(JSON.stringify(artifact.abi))
        .replace('GeneratedInterface', `I${contract}`);
    fs_1.default.writeFileSync(outputFile, solidity);
    console.log(`Generated interface I${contract}`);
});
//# sourceMappingURL=index.js.map