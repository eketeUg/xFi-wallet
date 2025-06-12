# xFi Bot 🤖📈

**xFi Bot** is a multichain DeFi bot that brings **social finance** directly to **Twitter**. It supports **Ethereum**, **Base**, and **Solana**, enabling users to **tip**, **send**, and **trade tokens** directly by tweeting @xFi_bot with simple commands.

---

## 🌟 Mission

Make DeFi interactions **social**, **accessible**, and **frictionless** for everyone — right on Twitter.

---

## 👥 Target Users

- Crypto traders and enthusiasts
- Twitter influencers in the blockchain/DeFi space
- Anyone who wants to send or trade crypto in a social way

---

## 🔗 Supported Chains

- **Ethereum**
- **Base**
- **Solana**

---

## 🧩 Key Features

### 🔐 Account Creation

- Users sign in via **Twitter OAuth** from the xFi web UI.
- A **new wallet** is **automatically generated** — no external wallet required.

### ⚙️ Bot Customization

- Set **default blockchain** for tips/trades.
- Enable or disable **direct bot notifications**.
- More customization options coming soon.

### 💸 Tipping & Sending Tokens

Users can tip or send tokens using a simple Twitter mention:

```text
@xFi_bot tip 1 eth to ekete.base.eth on base
@xFi_bot send 0.0001 eth to @eketeUg on base
@xFi_bot send 1 sol to @eketeUg
@xFi_bot send 1 sol to D6sFb1qwoLyZN2P2a4YVHTXBsQzc5miDkcqUCg6oeYeo
```

#### Supported recipient formats:

- Twitter usernames (e.g., `@vitalik`)
- ENS names (e.g., `vitalik.eth`)
- Base names (e.g., `jesse.base.eth`)
- Raw wallet addresses

> 🧾 Gas fees are deducted from the user’s generated wallet. No extra platform fees.

---

### 💱 Token Trading (on Solana)

Trading is currently available **only on Solana**, powered by **Raydium DEX**.

#### Example commands:

```text
@xFi_bot buy FQgtfugBdpFN7PZ6NdPrZpVLDBrPGxXesi4gVu3vErhY for 0.01 sol
@xFi_bot buy 0.01 SOL of FQgtfugBdpFN7PZ6NdPrZpVLDBrPGxXesi4gVu3vErhY
@xFi_bot sell all of FQgtfugBdpFN7PZ6NdPrZpVLDBrPGxXesi4gVu3vErhY
@xFi_bot sell 50% of FQgtfugBdpFN7PZ6NdPrZpVLDBrPGxXesi4gVu3vErhY
```

> 🔁 Trading supports **all tokens with Raydium liquidity pools** via their token mint addresses.

---

## 🪙 Supported Tokens

| Chain    | Tokens Supported |
| -------- | ---------------- |
| Ethereum | ETH, USDC, USDT  |
| Base     | ETH, USDC        |
| Solana   | SOL, USDC, USDT  |

---

## 🌐 Web UI Features

Visit the xFi web platform to:

- 🔐 Sign in via Twitter
- 💰 View multichain balances
- 📜 Access transaction history
- 💳 Fund your wallet
- ⚙️ Configure bot preferences

---

## 💵 Fee Structure

- ✅ **Free to use**
- ⛽ Users only pay **network gas fees**
- ❌ No platform/service fees at this time

---

## 🔒 Security

- Wallets are **custodial** and automatically created
- **Private keys are securely encrypted**
- Infrastructure follows best practices for key management and security

---

## 🛣️ Roadmap

- 🌍 Expand support to more blockchain networks
- 💱 Introduce **token trading on EVM chains**
- ✨ Add advanced bot features and on-platform DeFi tools

---

## ⚙️ Tech Stack & Dependencies

- Powered heavily by **[Coinbase AgentKit](https://github.com/coinbase/agentkit)** for EVM wallet and transaction infrastructure
- Raydium DEX integration for Solana token swaps
- Twitter OAuth for identity and user interaction

---

## 🤝 Contributing

Coming soon — Stay tuned for open-source modules and contribution guidelines.

---

## 📩 Contact

For support or collaboration, reach out via [Twitter](https://x.com/xFi_bot)

---

## 📝 License

MIT License
