"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeSlash, GoogleLogo, AppleLogo } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const { error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (loginError) {
            setError(loginError.message);
            setIsLoading(false);
            return;
        }

        router.push("/dashboard");
        router.refresh();
    };

    const handleGoogleSignIn = async () => {
        const { error: googleError } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (googleError) setError(googleError.message);
    };

    return (
        <div className="flex min-h-screen">
            {/* Left Panel — Branding */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-black p-12 text-white"
            >
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700">
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <path d="M2 12h20" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold tracking-[0.2em] uppercase">
                            {APP_NAME}
                        </span>
                    </div>
                </div>

                <div className="space-y-6">
                    <h1 className="text-5xl font-bold leading-[1.1] tracking-tight xl:text-6xl">
                        Welcome
                        <br />
                        back,
                        <br />
                        Traveler.
                    </h1>
                    <p className="max-w-md text-lg text-zinc-400 leading-relaxed">
                        Your finances, documents, and journeys — all in one place.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-8 w-8 rounded-full bg-zinc-700 border-2 border-black"
                                style={{
                                    background: `linear-gradient(135deg, #3f3f46 0%, #52525b 100%)`,
                                }}
                            />
                        ))}
                    </div>
                    <span className="text-xs font-medium tracking-[0.15em] uppercase text-zinc-400">
                        Joined by 20,000+ Nomads
                    </span>
                </div>
            </motion.div>

            {/* Right Panel — Form */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="flex w-full flex-col justify-center bg-zinc-950 px-6 py-12 lg:w-1/2 lg:px-16 xl:px-24"
            >
                <div className="mx-auto w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="mb-8 flex items-center gap-3 lg:hidden">
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

                    <h2 className="text-3xl font-semibold text-white">Welcome back</h2>
                    <p className="mt-2 text-sm text-zinc-400">
                        Don&apos;t have an account?{" "}
                        <Link
                            href="/signup"
                            className="text-white underline underline-offset-4 hover:text-zinc-300 transition-colors"
                        >
                            Sign up
                        </Link>
                    </p>

                    <form onSubmit={handleLogin} className="mt-8 space-y-5">
                        {/* Email */}
                        <div className="space-y-2">
                            <label
                                htmlFor="email"
                                className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400"
                            >
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label
                                    htmlFor="password"
                                    className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400"
                                >
                                    Password
                                </label>
                                <button
                                    type="button"
                                    className="text-xs text-zinc-500 hover:text-white transition-colors underline underline-offset-2"
                                >
                                    Forgot password?
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
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

                        {/* Error */}
                        {error && (
                            <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-sm text-red-400"
                            >
                                {error}
                            </motion.p>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-2xl bg-white py-4 text-sm font-semibold text-black transition-all hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg
                                        className="h-4 w-4 animate-spin"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                        />
                                    </svg>
                                    Signing in...
                                </span>
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative mt-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-zinc-800" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-zinc-950 px-4 text-xs font-medium tracking-[0.15em] uppercase text-zinc-500">
                                Or continue with
                            </span>
                        </div>
                    </div>

                    {/* OAuth */}
                    <div className="mt-6 grid grid-cols-2 gap-3">
                        <button
                            onClick={handleGoogleSignIn}
                            type="button"
                            className="flex items-center justify-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-sm font-medium text-white transition-all hover:bg-zinc-800 hover:border-zinc-700 active:scale-[0.98]"
                        >
                            <GoogleLogo size={18} weight="bold" />
                            Google
                        </button>
                        <button
                            type="button"
                            className="flex items-center justify-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-sm font-medium text-white transition-all hover:bg-zinc-800 hover:border-zinc-700 active:scale-[0.98]"
                        >
                            <AppleLogo size={18} weight="fill" />
                            Apple
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
