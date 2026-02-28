"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    User,
    CurrencyDollar,
    Vault,
    ArrowRight,
    ArrowLeft,
    Check,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/constants";
import type { Currency } from "@/types";

interface OnboardingData {
    fullName: string;
    baseCurrency: Currency;
    firstVaultName: string;
    firstVaultType: "savings" | "checking" | "cash";
}

const steps = [
    { id: 0, title: "Your profile", icon: User },
    { id: 1, title: "Base currency", icon: CurrencyDollar },
    { id: 2, title: "First vault", icon: Vault },
];

const slideVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 200 : -200,
        opacity: 0,
    }),
    center: {
        x: 0,
        opacity: 1,
    },
    exit: (direction: number) => ({
        x: direction < 0 ? 200 : -200,
        opacity: 0,
    }),
};

export default function OnboardingPage() {
    const router = useRouter();
    const supabase = createClient();

    const [currentStep, setCurrentStep] = useState(0);
    const [direction, setDirection] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<OnboardingData>({
        fullName: "",
        baseCurrency: "EUR",
        firstVaultName: "",
        firstVaultType: "checking",
    });

    const goNext = () => {
        if (currentStep < steps.length - 1) {
            setDirection(1);
            setCurrentStep((s) => s + 1);
        }
    };

    const goBack = () => {
        if (currentStep > 0) {
            setDirection(-1);
            setCurrentStep((s) => s - 1);
        }
    };

    const canProceed = () => {
        switch (currentStep) {
            case 0:
                return data.fullName.trim().length > 1;
            case 1:
                return true;
            case 2:
                return data.firstVaultName.trim().length > 0;
            default:
                return false;
        }
    };

    const handleComplete = async () => {
        setIsLoading(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Update profile
        await supabase
            .from("users_profile")
            .update({
                full_name: data.fullName,
                base_currency: data.baseCurrency,
                is_onboarded: true,
            })
            .eq("id", user.id);

        // Create first vault
        await supabase.from("vaults").insert({
            user_id: user.id,
            name: data.firstVaultName,
            currency: data.baseCurrency,
            type: data.firstVaultType,
        });

        router.push("/dashboard");
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-black px-4">
            <div className="w-full max-w-lg">
                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12 flex items-center justify-center gap-3"
                >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700">
                        <svg
                            width="20"
                            height="20"
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
                </motion.div>

                {/* Progress Steps */}
                <div className="mb-10 flex items-center justify-center gap-2">
                    {steps.map((step, i) => (
                        <div key={step.id} className="flex items-center gap-2">
                            <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${i < currentStep
                                        ? "bg-white text-black"
                                        : i === currentStep
                                            ? "bg-zinc-800 text-white border border-zinc-600"
                                            : "bg-zinc-900 text-zinc-600 border border-zinc-800"
                                    }`}
                            >
                                {i < currentStep ? (
                                    <Check size={14} weight="bold" />
                                ) : (
                                    i + 1
                                )}
                            </div>
                            {i < steps.length - 1 && (
                                <div
                                    className={`h-px w-12 transition-colors duration-300 ${i < currentStep ? "bg-white" : "bg-zinc-800"
                                        }`}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step Content */}
                <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-8 min-h-[320px]">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={currentStep}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                            {currentStep === 0 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-2xl font-semibold text-white">
                                            What should we call you?
                                        </h2>
                                        <p className="mt-2 text-sm text-zinc-400">
                                            This is how you&apos;ll appear in your Nomadix profile.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Alexander Nomad"
                                            value={data.fullName}
                                            onChange={(e) =>
                                                setData({ ...data, fullName: e.target.value })
                                            }
                                            autoFocus
                                            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
                                        />
                                    </div>
                                </div>
                            )}

                            {currentStep === 1 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-2xl font-semibold text-white">
                                            Choose your base currency
                                        </h2>
                                        <p className="mt-2 text-sm text-zinc-400">
                                            All your finances will default to this currency. You can
                                            always switch between EUR and USD.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(["EUR", "USD"] as Currency[]).map((currency) => (
                                            <button
                                                key={currency}
                                                type="button"
                                                onClick={() =>
                                                    setData({ ...data, baseCurrency: currency })
                                                }
                                                className={`flex flex-col items-center gap-3 rounded-2xl border p-6 transition-all ${data.baseCurrency === currency
                                                        ? "border-white bg-white/5"
                                                        : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                                                    }`}
                                            >
                                                <span className="text-3xl">
                                                    {currency === "EUR" ? "€" : "$"}
                                                </span>
                                                <div className="text-center">
                                                    <p
                                                        className={`text-sm font-semibold ${data.baseCurrency === currency
                                                                ? "text-white"
                                                                : "text-zinc-400"
                                                            }`}
                                                    >
                                                        {currency}
                                                    </p>
                                                    <p className="text-xs text-zinc-500">
                                                        {currency === "EUR" ? "Euro" : "US Dollar"}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-2xl font-semibold text-white">
                                            Create your first vault
                                        </h2>
                                        <p className="mt-2 text-sm text-zinc-400">
                                            A vault is where you organize your money. Think of it as a
                                            labeled box for a specific purpose.
                                        </p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                                Vault Name
                                            </label>
                                            <input
                                                type="text"
                                                placeholder='e.g. "Capital Inicial", "Ingresos España"'
                                                value={data.firstVaultName}
                                                onChange={(e) =>
                                                    setData({ ...data, firstVaultName: e.target.value })
                                                }
                                                autoFocus
                                                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                                Type
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(
                                                    [
                                                        { value: "checking", label: "Checking" },
                                                        { value: "savings", label: "Savings" },
                                                        { value: "cash", label: "Cash" },
                                                    ] as const
                                                ).map((type) => (
                                                    <button
                                                        key={type.value}
                                                        type="button"
                                                        onClick={() =>
                                                            setData({ ...data, firstVaultType: type.value })
                                                        }
                                                        className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${data.firstVaultType === type.value
                                                                ? "border-white bg-white text-black"
                                                                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                                                            }`}
                                                    >
                                                        {type.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Navigation */}
                <div className="mt-6 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={goBack}
                        disabled={currentStep === 0}
                        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:text-white disabled:opacity-0 disabled:pointer-events-none"
                    >
                        <ArrowLeft size={16} weight="bold" />
                        Back
                    </button>

                    {currentStep < steps.length - 1 ? (
                        <button
                            type="button"
                            onClick={goNext}
                            disabled={!canProceed()}
                            className="flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black transition-all hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                            Continue
                            <ArrowRight size={16} weight="bold" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleComplete}
                            disabled={!canProceed() || isLoading}
                            className="flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black transition-all hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                            {isLoading ? (
                                <>
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
                                    Setting up...
                                </>
                            ) : (
                                <>
                                    Get Started
                                    <Check size={16} weight="bold" />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
