// ============================================================
// blockchain.js — CampusToken Frontend Backend
// Include this file in ALL HTML pages:
// <script src="https://cdn.ethers.io/lib/ethers-5.7.umd.min.js"></script>
// <script src="./blockchain.js"></script>
// ============================================================

// ─────────────────────────────────────────────────────────────
// STEP 1: After deploying, paste your TokenFactory address here
// ─────────────────────────────────────────────────────────────
const FACTORY_ADDRESS = "0x368c3F5001d0A189f9A67FAc0B64119D21467388";

const SHARDEUM_CHAIN_ID = 8119;
const EXPLORER_URL = "https://explorer-mezame.shardeum.org";

// ─────────────────────────────────────────────────────────────
// ABIs
// ─────────────────────────────────────────────────────────────
const FACTORY_ABI = [
    "function createToken(string name, string symbol, uint supply) public",
    "function getAllTokens() public view returns (tuple(address tokenAddress, string name, string symbol, uint totalSupply, address creator, uint createdAt)[])",
    "function getTokensByCreator(address creator) public view returns (address[])",
    "function getTokenCount() public view returns (uint)",
    "event TokenCreated(address indexed tokenAddress, string name, string symbol, uint totalSupply, address indexed creator, uint createdAt)"
];

const TOKEN_ABI = [
    "function name() public view returns (string)",
    "function symbol() public view returns (string)",
    "function totalSupply() public view returns (uint)",
    "function owner() public view returns (address)",
    "function balanceOf(address) public view returns (uint)",
    "function transfer(address to, uint amount) public returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint amount)"
];

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
let provider, signer, userAddress, factoryContract;

// ─────────────────────────────────────────────────────────────
// CONNECT WALLET
// ─────────────────────────────────────────────────────────────
async function connectWallet() {
    if (!window.ethereum) {
        showToast("❌ MetaMask not found! Please install MetaMask.", "error");
        return false;
    }

    try {
        setButtonLoading("walletBtn", "Connecting...");

        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();

        // Check network and auto-switch to Shardeum if needed
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);
        console.log("Current chain ID:", chainId, "| Expected:", SHARDEUM_CHAIN_ID);

        if (chainId !== SHARDEUM_CHAIN_ID) {
            showToast("⚠️ Switching to Shardeum Testnet...", "info");
            try {
                await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: "0x1FB7" }]
                });
                provider = new ethers.providers.Web3Provider(window.ethereum);
                signer = provider.getSigner();
                userAddress = await signer.getAddress();
            } catch (switchErr) {
                if (switchErr.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: "wallet_addEthereumChain",
                            params: [{
                                chainId: "0x1FB7",
                                chainName: "Shardeum EVM Testnet",
                                nativeCurrency: { name: "SHM", symbol: "SHM", decimals: 18 },
                                rpcUrls: ["https://api-mezame.shardeum.org"],
                                blockExplorerUrls: ["https://explorer-mezame.shardeum.org"]
                            }]
                        });
                        provider = new ethers.providers.Web3Provider(window.ethereum);
                        signer = provider.getSigner();
                        userAddress = await signer.getAddress();
                    } catch (addErr) {
                        showToast("❌ Please add Shardeum Testnet manually (Chain ID: 8119)", "error");
                        resetButton("walletBtn", "Connect Wallet");
                        return false;
                    }
                } else {
                    showToast("❌ Please switch to Shardeum Testnet in MetaMask (Chain ID: 8119)", "error");
                    resetButton("walletBtn", "Connect Wallet");
                    return false;
                }
            }
        }

        // Initialize factory contract
        factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);

        // Update all wallet UI elements on the page
        const shortAddr = shortenAddress(userAddress);
        updateWalletUI(shortAddr);

        showToast("✅ Wallet connected: " + shortAddr, "success");

        // Listen for account/network changes
        window.ethereum.on("accountsChanged", () => window.location.reload());
        window.ethereum.on("chainChanged", () => window.location.reload());

        // Trigger page-specific logic
        if (typeof onWalletConnected === "function") {
            await onWalletConnected();
        }

        return true;

    } catch (err) {
        console.error("Connection error:", err);
        showToast("❌ Failed to connect wallet.", "error");
        resetButton("walletBtn", "Connect Wallet");
        return false;
    }
}

// ─────────────────────────────────────────────────────────────
// LAUNCH TOKEN (Landing Page)
// ─────────────────────────────────────────────────────────────
async function launchToken() {
    if (!signer) {
        showToast("Please connect your wallet first!", "error");
        return;
    }

    const nameEl = document.getElementById("tokenName");
    const symbolEl = document.getElementById("tokenSymbol");
    const supplyEl = document.getElementById("tokenSupply");

    const name = nameEl?.value.trim();
    const symbol = symbolEl?.value.trim().toUpperCase();
    const supply = supplyEl?.value;

    // Validation
    let hasError = false;
    if (!name) { showFieldError("tokenName", "Token name is required"); hasError = true; }
    else clearFieldError("tokenName");

    if (!symbol) { showFieldError("tokenSymbol", "Symbol is required"); hasError = true; }
    else if (symbol.length > 5) { showFieldError("tokenSymbol", "Max 5 characters"); hasError = true; }
    else clearFieldError("tokenSymbol");

    if (!supply || supply <= 0) { showFieldError("tokenSupply", "Enter a valid supply"); hasError = true; }
    else clearFieldError("tokenSupply");

    if (hasError) return;

    try {
        setButtonLoading("launchBtn", "Deploying to Shardeum...");
        disableForm(true);

        const tx = await factoryContract.createToken(name, symbol, supply);
        showToast("⏳ Transaction sent! Waiting for confirmation...", "info");

        const receipt = await tx.wait();

        // Extract token address from event
        const event = receipt.events?.find(e => e.event === "TokenCreated");
        const tokenAddress = event?.args?.tokenAddress;

        if (!tokenAddress) throw new Error("Could not get token address from transaction");

        // Save token to localStorage for dashboard
        localStorage.setItem("campusToken_address", tokenAddress);
        localStorage.setItem("campusToken_name", name);
        localStorage.setItem("campusToken_symbol", symbol);

        showToast("🎉 Token launched successfully!", "success");
        showSuccessCard(name, symbol, tokenAddress, tx.hash);

    } catch (err) {
        console.error("Launch failed:", err);
        showToast("❌ " + (err.reason || err.message || "Transaction failed"), "error");
        resetButton("launchBtn", "Launch Token");
        disableForm(false);
    }
}

function showSuccessCard(name, symbol, tokenAddress, txHash) {
    const form = document.getElementById("createForm");
    const success = document.getElementById("successCard");

    if (form) form.style.display = "none";
    if (success) {
        success.style.display = "block";
        const nameEl = document.getElementById("successTokenName");
        const addrEl = document.getElementById("successAddress");
        const linkEl = document.getElementById("explorerLink");
        const dashBtn = document.getElementById("dashboardBtn");

        if (nameEl) nameEl.innerText = name + " (" + symbol + ")";
        if (addrEl) addrEl.innerText = tokenAddress;
        if (linkEl) linkEl.href = `${EXPLORER_URL}/address/${tokenAddress}`;
        if (dashBtn) dashBtn.href = "dashboard.html";
    }
}

// ─────────────────────────────────────────────────────────────
// LOAD DASHBOARD
// ─────────────────────────────────────────────────────────────
async function loadDashboard() {
    const tokenAddress = localStorage.getItem("campusToken_address");

    if (!tokenAddress) {
        showToast("No token found. Please create a token first.", "error");
        setTimeout(() => window.location.href = "index.html", 2000);
        return;
    }

    try {
        const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);

        const [name, symbol, totalSupply, balance] = await Promise.all([
            tokenContract.name(),
            tokenContract.symbol(),
            tokenContract.totalSupply(),
            tokenContract.balanceOf(userAddress)
        ]);

        // Update UI elements
        setText("displayTokenName", name);
        setText("displayTokenSymbol", symbol);
        setText("displayTotalSupply", Number(totalSupply).toLocaleString());
        setText("displayBalance", Number(balance).toLocaleString());
        setText("displaySymbol", symbol);
        setText("displayTokenAddress", tokenAddress);

        // Copy address button
        const copyBtn = document.getElementById("copyAddressBtn");
        if (copyBtn) {
            copyBtn.onclick = () => copyToClipboard(tokenAddress);
        }

        // Explorer link
        const explorerBtn = document.getElementById("explorerBtn");
        if (explorerBtn) {
            explorerBtn.href = `${EXPLORER_URL}/address/${tokenAddress}`;
        }

        // Load activity feed
        await loadActivityFeed(tokenContract);

    } catch (err) {
        console.error("Dashboard load error:", err);
        showToast("❌ Failed to load token data.", "error");
    }
}

// ─────────────────────────────────────────────────────────────
// SEND TOKENS (Dashboard)
// ─────────────────────────────────────────────────────────────
async function sendTokens() {
    const tokenAddress = localStorage.getItem("campusToken_address");
    const recipient = document.getElementById("recipientAddress")?.value.trim();
    const amount = document.getElementById("sendAmount")?.value;

    // Validation
    if (!ethers.utils.isAddress(recipient)) {
        showFieldError("recipientAddress", "Invalid wallet address");
        return;
    } else clearFieldError("recipientAddress");

    if (!amount || amount <= 0) {
        showFieldError("sendAmount", "Enter a valid amount");
        return;
    } else clearFieldError("sendAmount");

    try {
        setButtonLoading("sendBtn", "Sending...");

        const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
        const tx = await tokenContract.transfer(recipient, amount);

        showToast("⏳ Sending tokens...", "info");
        await tx.wait();

        showToast("✅ Tokens sent successfully!", "success");

        // Clear form
        document.getElementById("recipientAddress").value = "";
        document.getElementById("sendAmount").value = "";

        // Refresh dashboard
        await loadDashboard();

    } catch (err) {
        console.error("Send failed:", err);
        showToast("❌ " + (err.reason || err.message || "Send failed"), "error");
    } finally {
        resetButton("sendBtn", "Send Tokens");
    }
}

// ─────────────────────────────────────────────────────────────
// ACTIVITY FEED
// ─────────────────────────────────────────────────────────────
async function loadActivityFeed(tokenContract) {
    const feedEl = document.getElementById("activityFeed");
    if (!feedEl) return;

    feedEl.innerHTML = `<p class="text-center text-on-surface-variant py-4">Loading activity...</p>`;

    try {
        const filter = tokenContract.filters.Transfer();
        const events = await tokenContract.queryFilter(filter, -5000);

        if (events.length === 0) {
            feedEl.innerHTML = `
                <div class="flex flex-col items-center justify-center py-8 text-on-surface-variant">
                    <span class="material-symbols-outlined text-4xl mb-2">inbox</span>
                    <p>No transactions yet. Start distributing tokens!</p>
                </div>`;
            return;
        }

        feedEl.innerHTML = "";

        events.reverse().slice(0, 15).forEach(event => {
            const from = event.args[0];
            const to = event.args[1];
            const amount = event.args[2];

            const isSent = from.toLowerCase() === userAddress?.toLowerCase();
            const isMint = from === "0x0000000000000000000000000000000000000000";
            const shortFrom = shortenAddress(from);
            const shortTo = shortenAddress(to);
            const txUrl = `${EXPLORER_URL}/tx/${event.transactionHash}`;

            let label, icon, colorClass;
            if (isMint) {
                label = "Minted to <span class='font-bold text-on-surface'>" + shortTo + "</span>";
                icon = "add_circle";
                colorClass = "text-primary";
            } else if (isSent) {
                label = "Sent to <span class='font-bold text-on-surface'>" + shortTo + "</span>";
                icon = "call_made";
                colorClass = "text-error";
            } else {
                label = "Received from <span class='font-bold text-on-surface'>" + shortFrom + "</span>";
                icon = "call_received";
                colorClass = "text-secondary";
            }

            feedEl.innerHTML += `
                <div class="flex items-center justify-between p-4 rounded-xl bg-surface-container/30 hover:bg-surface-container/60 transition-colors mb-3">
                    <div class="flex items-center gap-4">
                        <div class="h-10 w-10 rounded-full bg-surface-container flex items-center justify-center">
                            <span class="material-symbols-outlined ${colorClass} text-xl">${icon}</span>
                        </div>
                        <div>
                            <p class="text-sm font-medium">${label}</p>
                            <p class="text-xs text-on-surface-variant">Block #${event.blockNumber}</p>
                        </div>
                    </div>
                    <div class="text-right flex items-center gap-3">
                        <p class="${colorClass} font-bold">${isSent ? "-" : "+"} ${Number(amount).toLocaleString()}</p>
                        <a href="${txUrl}" target="_blank" class="text-on-surface-variant hover:text-primary transition-colors">
                            <span class="material-symbols-outlined text-sm">open_in_new</span>
                        </a>
                    </div>
                </div>`;
        });

    } catch (err) {
        console.error("Activity feed error:", err);
        feedEl.innerHTML = `<p class="text-center text-error py-4">Failed to load activity.</p>`;
    }
}

// ─────────────────────────────────────────────────────────────
// LEADERBOARD
// ─────────────────────────────────────────────────────────────
async function loadLeaderboard() {
    const tbody = document.getElementById("tokenTableBody");
    const countEl = document.getElementById("totalTokenCount");

    if (!tbody) return;

    tbody.innerHTML = `
        <tr><td colspan="5" class="text-center py-8 text-on-surface-variant">
            Loading tokens...
        </td></tr>`;

    try {
        const tokens = await factoryContract.getAllTokens();

        if (countEl) countEl.innerText = tokens.length.toLocaleString();

        if (tokens.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="5" class="text-center py-8 text-on-surface-variant">
                    No tokens launched yet. Be the first!
                </td></tr>`;
            return;
        }

        tbody.innerHTML = "";

        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            const isYours = userAddress && t.creator.toLowerCase() === userAddress.toLowerCase();
            const explorerUrl = `${EXPLORER_URL}/address/${t.tokenAddress}`;
            const initial = t.symbol.charAt(0).toUpperCase();

            const gradients = [
                "from-primary to-primary-dim",
                "from-secondary to-secondary-dim",
                "from-tertiary to-tertiary-dim",
                "from-primary to-secondary",
            ];
            const gradient = gradients[i % gradients.length];

            tbody.innerHTML += `
                <tr class="hover:bg-surface-container transition-colors cursor-pointer group"
                    onclick="window.open('${explorerUrl}', '_blank')">
                    <td class="py-6 px-6 font-bold ${i === 0 ? "text-primary" : "text-on-surface-variant"} font-headline">
                        #${String(i + 1).padStart(2, "0")}
                        ${i === 0 ? '<span class="ml-1">🥇</span>' : ""}
                    </td>
                    <td class="py-6 px-6">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full bg-gradient-to-br ${gradient}
                                 flex items-center justify-center font-bold text-on-primary-fixed shadow-lg">
                                ${initial}
                            </div>
                            <div>
                                <div class="font-bold text-on-surface flex items-center gap-2">
                                    ${t.name}
                                    ${isYours ? '<span class="text-xs bg-secondary-container text-secondary px-2 py-0.5 rounded-full">You</span>' : ""}
                                </div>
                                <div class="text-xs text-on-surface-variant font-mono">$${t.symbol}</div>
                            </div>
                        </div>
                    </td>
                    <td class="py-6 px-6 font-medium">${Number(t.totalSupply).toLocaleString()}</td>
                    <td class="py-6 px-6 font-mono text-xs text-on-surface-variant">
                        ${shortenAddress(t.creator)}
                    </td>
                    <td class="py-6 px-6 text-right">
                        <span class="opacity-0 group-hover:opacity-100 transition-opacity text-primary text-xs font-bold flex items-center justify-end gap-1">
                            View <span class="material-symbols-outlined text-xs">open_in_new</span>
                        </span>
                    </td>
                </tr>`;
        }

    } catch (err) {
        console.error("Leaderboard error:", err);
        tbody.innerHTML = `
            <tr><td colspan="5" class="text-center py-8 text-error">
                Failed to load tokens.
            </td></tr>`;
    }
}

// ─────────────────────────────────────────────────────────────
// SEARCH / FILTER (Leaderboard)
// ─────────────────────────────────────────────────────────────
function filterLeaderboard(query) {
    const rows = document.querySelectorAll("#tokenTableBody tr");
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(query.toLowerCase()) ? "" : "none";
    });
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function shortenAddress(addr) {
    if (!addr) return "";
    return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("📋 Copied to clipboard!", "success");
    });
}

function setButtonLoading(id, text) {
    const btn = document.getElementById(id);
    if (btn) {
        btn.dataset.originalText = btn.innerText;
        btn.innerText = text;
        btn.disabled = true;
    }
}

function resetButton(id, text) {
    const btn = document.getElementById(id);
    if (btn) {
        btn.innerText = text || btn.dataset.originalText || "Submit";
        btn.disabled = false;
    }
}

function disableForm(disabled) {
    ["tokenName", "tokenSymbol", "tokenSupply", "launchBtn"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = disabled;
    });
}

function updateWalletUI(shortAddr) {
    // Update any wallet button or display
    ["walletBtn", "walletAddress", "walletDisplay"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === "BUTTON") {
                el.innerHTML = `<span style="color:#5af8fb">●</span> ${shortAddr}`;
                el.style.background = "rgba(90, 248, 251, 0.1)";
                el.style.border = "1px solid rgba(90, 248, 251, 0.3)";
            } else {
                el.innerText = shortAddr;
            }
        }
    });
}

function showFieldError(id, message) {
    const el = document.getElementById(id);
    if (el) {
        el.style.outline = "2px solid #ff6e84";
        let errEl = document.getElementById(id + "_error");
        if (!errEl) {
            errEl = document.createElement("p");
            errEl.id = id + "_error";
            errEl.style.cssText = "color:#ff6e84;font-size:12px;margin-top:4px;padding-left:8px;";
            el.parentNode.appendChild(errEl);
        }
        errEl.innerText = message;
    }
}

function clearFieldError(id) {
    const el = document.getElementById(id);
    if (el) el.style.outline = "";
    const errEl = document.getElementById(id + "_error");
    if (errEl) errEl.remove();
}

function showToast(message, type = "info") {
    // Remove existing toast
    const existing = document.getElementById("campusToast");
    if (existing) existing.remove();

    const colors = {
        success: "#5af8fb",
        error: "#ff6e84",
        info: "#ca98ff"
    };

    const toast = document.createElement("div");
    toast.id = "campusToast";
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 24px;
        z-index: 9999;
        background: #16172f;
        border: 1px solid ${colors[type] || colors.info};
        color: #e4e3fe;
        padding: 14px 20px;
        border-radius: 12px;
        font-size: 14px;
        font-family: Inter, sans-serif;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        max-width: 360px;
        animation: slideIn 0.3s ease;
    `;
    toast.innerText = message;

    const style = document.createElement("style");
    style.innerText = `@keyframes slideIn { from { opacity:0; transform: translateX(20px); } to { opacity:1; transform: translateX(0); } }`;
    document.head.appendChild(style);

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ─────────────────────────────────────────────────────────────
// AUTO-INIT — wire wallet button on every page
// ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    const walletBtn = document.getElementById("walletBtn");
    if (walletBtn) walletBtn.addEventListener("click", connectWallet);

    const launchBtn = document.getElementById("launchBtn");
    if (launchBtn) launchBtn.addEventListener("click", launchToken);

    const sendBtn = document.getElementById("sendBtn");
    if (sendBtn) sendBtn.addEventListener("click", sendTokens);

    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.addEventListener("input", e => filterLeaderboard(e.target.value));

    const copyBtn = document.getElementById("copyAddressBtn");
    if (copyBtn) copyBtn.addEventListener("click", () => {
        const addr = document.getElementById("displayTokenAddress")?.innerText;
        if (addr) copyToClipboard(addr);
    });
});
