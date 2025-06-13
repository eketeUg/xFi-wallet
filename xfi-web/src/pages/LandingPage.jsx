import React from 'react';
import { FaXTwitter } from 'react-icons/fa6';

export default function LandingPage() {
    const handleSignIn = () => {
        window.location.href = "https://app.eventblink.xyz/xfi/auth/twitter";
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white py-10 px-4">
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
            <div className="w-full max-w-lg border-2 border-gray-700 rounded-2xl p-10 text-center flex flex-col justify-between min-h-[80vh] max-h-[90vh]">
                <div className="text-center px-4">
                    <img src="/xFi-logo.png" alt="xFi" className="w-40 mx-auto mb-4 mt-6" />

                    <p className="text-gray-400 text-xl font-medium mb-3">
                        DeFi is now a tweet away.
                    </p>

                    <p className="text-gray-400 text-lg mb-8">
                        Tip, send, and trade tokens instantly on Twitter using{" "}
                        <a
                            href="https://twitter.com/xfi_xyz_bot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-200 underline hover:text-blue-400 transition font-semibold"
                        >
                            @xFi_bot
                        </a>.
                    </p>
                </div>
                <div>
                    <button
                        onClick={handleSignIn}
                        className="bg-white text-black px-6 py-3 rounded-full font-semibold hover:bg-gray-300 transition mb-6 hover:cursor-pointer"
                    >
                        Sign in with X
                    </button>
                </div>
            </div>
        </div>
    );
}