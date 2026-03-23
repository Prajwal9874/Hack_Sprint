const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Deploying CampusToken contracts to Shardeum...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("📦 Deploying from wallet:", deployer.address);

    // Deploy TokenFactory
    const TokenFactory = await hre.ethers.getContractFactory("TokenFactory");
    const factory = await TokenFactory.deploy();

    // Handle both old and new Hardhat versions
    if (factory.waitForDeployment) {
        await factory.waitForDeployment();                  // Hardhat v3 / ethers v6
    } else {
        await factory.deployed();                           // Hardhat v2 / ethers v5
    }

    // Get address (works for both versions)
    const factoryAddress = factory.target ?? factory.address;

    console.log("✅ TokenFactory deployed!");
    console.log("📍 Address:", factoryAddress);
    console.log("🔗 Explorer: https://explorer-mezame.shardeum.org/address/" + factoryAddress);
    console.log("");

    // Save address to config file
    const config = {
        TokenFactory: factoryAddress,
        network: "Shardeum Testnet",
        chainId: 8119,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address
    };

    // Save to root
    fs.writeFileSync(
        path.join(__dirname, "../contract-config.json"),
        JSON.stringify(config, null, 2)
    );

    // Also save to frontend folder if it exists
    const frontendPaths = ["../frontend", "../src", "../public"];
    for (const p of frontendPaths) {
        const fullPath = path.join(__dirname, p);
        if (fs.existsSync(fullPath)) {
            fs.writeFileSync(
                path.join(fullPath, "contract-config.json"),
                JSON.stringify(config, null, 2)
            );
            console.log("📄 Config saved to", p);
        }
    }

    console.log("📄 contract-config.json saved to project root");
    console.log("\n✅ Deployment complete!");
    console.log("👉 Copy this address into your frontend blockchain.js:");
    console.log('   const FACTORY_ADDRESS = "' + factoryAddress + '";');
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
});
