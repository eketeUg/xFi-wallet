import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';

export default function HomePage() {
    const location = useLocation();

    const [user, setUser] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [selectedChains, setSelectedChains] = useState([]);
    const [openWallet, setOpenWallet] = useState(null);
    const [evmBalances, setEvmBalances] = useState({});
    const [svmBalances, setSvmBalances] = useState({});

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        let twitterId = params.get('twitterId');

        if (twitterId) {
            localStorage.setItem('twitterId', twitterId);
        } else {
            twitterId = localStorage.getItem('twitterId');
        }

        if (twitterId) {
            fetchUserData(twitterId);
            fetchTransactions(twitterId);
            fetchAllBalances(twitterId);
        }
    }, [location.search]);

    const fetchUserData = async (id) => {
        try {
            const res = await fetch(`https://app.eventblink.xyz/xfi-mantle/users/${id}`);
            const data = await res.json();
            if (data.chains === null) data.chains = [];
            setUser(data);
            setSelectedChains(data.chains);
        } catch (err) {
            console.error('Failed to fetch user:', err);
        }
    };

    const fetchTransactions = async (id) => {
        try {
            const res = await fetch(`https://app.eventblink.xyz/xfi-mantle/users/history/${id}`);
            const data = await res.json();
            setTransactions(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch transactions:', err);
            setTransactions([]);
        }
    };

    const fetchAllBalances = async (userId) => {
        const chains = ['mantle'];
        const evmResult = {};

        for (let chain of chains) {
            try {
                const res = await fetch(`https://app.eventblink.xyz/xfi-mantle/users/${userId}/evm-balance?chain=${chain}`);
                const data = await res.json();

                evmResult[capitalize(chain)] = data.map(({ tokenSymbol, tokenName, amount }) => ({
                    symbol: tokenSymbol,
                    name: tokenName,
                    amount: parseFloat(amount).toFixed(4),
                }));
            } catch (err) {
                console.error(`Failed to fetch ${chain} balances:`, err);
            }
        }

        setEvmBalances(evmResult);

        try {
            const res = await fetch(`https://app.eventblink.xyz/xfi-mantle/users/${userId}/svm-balance`);
            const data = await res.json();

            const svm = data.map(({ tokenSymbol, tokenName, amount }) => ({
                symbol: tokenSymbol,
                name: tokenName,
                amount: parseFloat(amount).toFixed(4),
            }));

            setSvmBalances({ Solana: svm });
        } catch (err) {
            console.error("Failed to fetch SVM balances", err);
        }
    };

    const handleChainChange = async (chain, checked) => {
        const updatedChains = checked
            ? [...selectedChains, chain]
            : selectedChains.filter(c => c !== chain);

        setSelectedChains(updatedChains);

        const userId = localStorage.getItem("twitterId");
        try {
            await fetch(`https://app.eventblink.xyz/xfi-mantle/users/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chains: updatedChains }),
            });
        } catch (err) {
            console.error("Failed to update chains", err);
        }
    };

    const trimDescription = (desc, length = 40) =>
        desc?.length > length ? `${desc.slice(0, length)}...` : desc || '';

    if (!user) return <div></div>;

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-gray-200 py-10 px-4">
            <div className="absolute top-12 right-4">
                <a
                    href="https://x.com/xFi_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white mr-[15vw] hover:text-blue-400 transition"
                    title="Launch xFI Bot on Twitter"
                >
                    <FaXTwitter size={24} />
                </a>
            </div>
            <div className="w-full max-w-xl flex flex-col gap-8 justify-center">
                <div className="border border-gray-700 rounded-2xl p-6">
                    <h2 className="text-2xl font-semibold text-gray-300 mb-4">User Details</h2>
                    <div className="space-y-4">
                        <InfoRow
                            title="Username"
                            value={
                                user.username ? (
                                    <a
                                        href={`https://twitter.com/${user.username}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-200 hover:text-blue-400 underline transition"
                                    >
                                        @{user.username}
                                    </a>
                                ) : (
                                    '-'
                                )
                            }
                        />
                        <InfoRow title="Display Name" value={user.name || '-'} />
                        <div className="space-y-6 text-white">
                            <BalanceSection
                                title="Wallet Details"
                                address={user.evmWalletAddress}
                                chains={evmBalances}
                                isOpen={openWallet === 'EVM'}
                                onToggle={() => setOpenWallet(openWallet === 'EVM' ? null : 'EVM')}
                            />
                            {/* <BalanceSection
                                title="SVM Wallet"
                                address={user.svmWalletAddress}
                                chains={svmBalances}
                                isOpen={openWallet === 'SVM'}
                                onToggle={() => setOpenWallet(openWallet === 'SVM' ? null : 'SVM')}
                            /> */}
                        </div>
                        <div className="flex justify-between items-start gap-4">
                            <span className="text-gray-400 mt-1">Selected Chains</span>
                            <div className="flex flex-col gap-2">
                                {["Mantle"].map((chain) => (
                                    <label key={chain} className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            value={chain}
                                            checked={selectedChains.includes(chain)}
                                            onChange={(e) => handleChainChange(e.target.value, e.target.checked)}
                                            className="accent-gray-600"
                                        />
                                        <span>{chain}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border border-gray-700 rounded-2xl p-6">
                    <h2 className="text-2xl font-semibold text-gray-300 mb-4">Transactions</h2>
                    {transactions.length === 0 ? (
                        <p className="text-gray-500">No transactions yet.</p>
                    ) : (
                        <ul className="space-y-4">
                            {transactions.map((tx, idx) => (
                                <li key={idx} className="border border-gray-600 rounded-xl p-4 flex justify-between items-start">
                                    <div className="flex flex-col max-w-[60%]">
                                        <span
                                            className="text-base font-medium truncate mb-2"
                                            title={removeAtUsername(tx.meta?.originalCommand || '')}
                                        >
                                            {trimDescription(removeAtUsername(tx.meta?.originalCommand || ''))}
                                        </span>
                                        <span className="text-sm text-gray-500">{formatDate(tx.createdAt)}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-base font-semibold mb-1">{tx.amount}</div>
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium inline-block mt-1 whitespace-nowrap ${tx.status === 'Success' ? 'bg-green-700 text-white' :
                                            tx.status === 'Pending' ? 'bg-yellow-600 text-black' : 'bg-green-700 text-white'
                                            }`}>
                                            success
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const shortenAddress = (address) =>
    address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

function InfoRow({ title, value }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-gray-400">{title}</span>
            <span>{value}</span>
        </div>
    );
}

function formatTokenAmount(amount, symbol) {
    if (!amount || isNaN(amount)) return `0${symbol}`;
    const num = parseFloat(amount);
    const rounded = Math.round(num * 1000) / 1000; // round to 3 decimal places
    const final = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toString();
    return `${final}${symbol}`;
}

function formatDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

function removeAtUsername(text) {
    return text.replace(/^@\S+\s*/, '');
}

function BalanceSection({ title, address, chains, isOpen, onToggle }) {
    const [openChain, setOpenChain] = useState(null);
    const [copied, setCopied] = useState(false);

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const toggleChain = (chain) => {
        setOpenChain(openChain === chain ? null : chain);
    };

    return (
        <div className="border-y border-gray-700 py-4">
            <div
                className="flex items-center cursor-pointer"
                onClick={onToggle}
            >
                <span className="text-lg text-white font-medium flex-1">{title}</span>

                <div className="flex flex-col items-end" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={handleCopy}
                        className="bg-gray-800 text-white px-3 py-1 rounded text-sm border border-gray-600 font-mono hover:bg-gray-700 transition"
                        title="Click to copy"
                    >
                        {shortenAddress(address)}
                    </button>
                    {copied && <span className="text-xs text-green-400 mt-1">Copied!</span>}
                </div>

                <span className="ml-3">
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </span>
            </div>

            {isOpen && (
                <div className="mt-4 space-y-4 pl-8">
                    {Object.entries(chains).map(([chain, tokens]) => (
                        <div key={chain}>
                            <div
                                className="flex justify-between items-center cursor-pointer"
                                onClick={() => toggleChain(chain)}
                            >
                                <span className="text-gray-300 font-medium">{chain}</span>
                                {openChain === chain ? (
                                    <ChevronDown size={16} />
                                ) : (
                                    <ChevronRight size={16} />
                                )}
                            </div>

                            {openChain === chain && (
                                <ul className="ml-4 mt-2 space-y-1">
                                    {Array.isArray(tokens) && tokens.map(({ name, symbol, amount }) => (
                                        <li
                                            key={name + symbol}
                                            className="flex justify-between text-sm text-gray-200"
                                        >
                                            <span>{capitalize(name)}</span>
                                            <span className="font-mono">{formatTokenAmount(amount, symbol)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}