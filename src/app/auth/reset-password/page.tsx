"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/constants";

export default function ResetPasswordPage() {
    const router = useRouter();
    const supabase = createClient();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError("Passwords don't match.");
            return;
        }

        setIsLoading(true);
        setError(null);

        const { error: updateError } = await supabase.auth.updateUser({
            password,
        });

        setIsLoading(false);

        if (updateError) {
            setError(updateError.message);
            return;
        }

        setDone(true);
        setTimeout(() => {
            router.push("/login");
            router.refresh();
        }, 2000);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <div className="mb-8 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700">
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M2 12h20" />
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                    </div>
                    <span className="text-sm font-semibold tracking-[0.2em] uppercase text-white">
                        {APP_NAME}
                    </span>
                </div>

                {done ? (
                    <div>
                        <h2 className="text-3xl font-semibold text-white">
                            Password updated
                        </h2>
                        <p className="mt-2 text-sm text-zinc-400">
                            Taking you to sign in...
                        </p>
                    </div>
                ) : (
                    <>
                        <h2 className="text-3xl font-semibold text-white">
                            Set a new password
                        </h2>
                        <p className="mt-2 text-sm text-zinc-400">
                            Choose a new password for your account.
                        </p>

                        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                            <div className="space-y-2">
                                <label
                                    htmlFor="password"
                                    className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400"
                                >
                                    New Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={8}
                                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 pr-12 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                                    >
                                        {showPassword ? (
                                            <EyeSlash size={18} weight="bold" />
                                        ) : (
                                            <Eye size={18} weight="bold" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label
                                    htmlFor="confirmPassword"
                                    className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400"
                                >
                                    Confirm Password
                                </label>
                                <input
                                    id="confirmPassword"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
                                />
                            </div>

                            {error && (
                                <motion.p
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-sm text-red-400"
                                >
                                    {error}
                                </motion.p>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full rounded-2xl bg-white py-4 text-sm font-semibold text-black transition-all hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {isLoading ? "Updating..." : "Update password"}
                            </button>
                        </form>
                    </>
                )}
            </motion.div>
        </div>
    );
}
