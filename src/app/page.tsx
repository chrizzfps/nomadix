import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { HeroLedger } from "@/components/marketing/hero-ledger";

function Logo({ light = false }: { light?: boolean }) {
    return (
        <div className="flex items-center gap-2.5">
            <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                    light
                        ? "border-zinc-300 bg-zinc-100"
                        : "border-zinc-700 bg-zinc-800"
                }`}
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={light ? "text-black" : "text-white"}
                >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
            </div>
            <span
                className={`text-sm font-semibold tracking-[0.2em] uppercase ${
                    light ? "text-black" : "text-white"
                }`}
            >
                {APP_NAME}
            </span>
        </div>
    );
}

const features = [
    {
        name: "Vaults",
        description:
            "Split your money into vaults by purpose and currency — operating, savings, taxes, whatever your work needs. Every vault carries its own balance and history.",
    },
    {
        name: "Receivables",
        description:
            "Track what clients owe you and when it's due. See pending collections next to your real, spendable balance so you never confuse the two.",
    },
    {
        name: "Subscriptions",
        description:
            "Every recurring charge, on any billing cycle, in one list. Know what renews this week and what it's quietly costing you every year.",
    },
    {
        name: "Reports",
        description:
            "Export clean, currency-aware reports for taxes, clients, or your own records — built from the same ledger you already keep.",
    },
];

const steps = [
    {
        n: "01",
        title: "Set up your vaults",
        description:
            "Add a vault for every account and currency you actually use — no forced categories, no fixed bank.",
    },
    {
        n: "02",
        title: "Let it track itself",
        description:
            "Expenses, subscriptions and receivables update on their own as money moves.",
    },
    {
        n: "03",
        title: "Export when it matters",
        description:
            "Pull a clean report the moment a client, an accountant, or tax season asks for one.",
    },
];

export default function Home() {
    return (
        <div className="bg-white">
            {/* Nav */}
            <header className="border-b border-zinc-800 bg-black">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
                    <Logo />
                    <nav className="flex items-center gap-6">
                        <Link
                            href="/login"
                            className="hidden text-sm font-medium text-zinc-400 transition-colors hover:text-white sm:block"
                        >
                            Log in
                        </Link>
                        <Link
                            href="/signup"
                            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
                        >
                            Get started
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Hero */}
            <section className="bg-black">
                <div className="mx-auto grid max-w-6xl gap-16 px-6 py-24 lg:grid-cols-2 lg:items-center lg:py-32">
                    <div>
                        <h1 className="text-5xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">
                            Run your money
                            <br />
                            like the business
                            <br />
                            it is.
                        </h1>
                        <p className="mt-6 max-w-md text-lg leading-relaxed text-zinc-400">
                            {APP_NAME} is where digital nomads and freelancers keep
                            vaults, receivables, subscriptions and reports in one
                            ledger — in any currency, from anywhere.
                        </p>
                        <div className="mt-10 flex flex-wrap items-center gap-4">
                            <Link
                                href="/signup"
                                className="rounded-2xl bg-white px-7 py-4 text-sm font-semibold text-black transition-all hover:bg-zinc-200 active:scale-[0.98]"
                            >
                                Get started
                            </Link>
                            <Link
                                href="/login"
                                className="text-sm font-medium text-zinc-400 underline underline-offset-4 transition-colors hover:text-white"
                            >
                                Log in
                            </Link>
                        </div>
                    </div>

                    <div className="flex justify-center lg:justify-end">
                        <HeroLedger />
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="border-b border-zinc-200 bg-white">
                <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-zinc-200 px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    {[
                        { value: "6", label: "currencies per account" },
                        { value: "20,000+", label: "people tracking their money here" },
                        { value: "0", label: "spreadsheets required" },
                    ].map((stat) => (
                        <div key={stat.label} className="px-0 py-10 sm:px-10">
                            <p className="font-mono text-4xl font-semibold text-black">
                                {stat.value}
                            </p>
                            <p className="mt-2 text-sm text-zinc-500">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features */}
            <section id="features" className="bg-white">
                <div className="mx-auto max-w-6xl px-6 py-24">
                    <h2 className="max-w-xl text-4xl font-bold tracking-tight text-black sm:text-5xl">
                        Everything a location-independent income needs.
                    </h2>

                    <div className="mt-16 divide-y divide-zinc-200 border-t border-zinc-200">
                        {features.map((feature) => (
                            <div
                                key={feature.name}
                                className="grid gap-4 py-10 sm:grid-cols-[220px_1fr] sm:gap-10"
                            >
                                <h3 className="text-2xl font-semibold text-black">
                                    {feature.name}
                                </h3>
                                <p className="max-w-xl text-base leading-relaxed text-zinc-600">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="bg-zinc-950">
                <div className="mx-auto max-w-6xl px-6 py-24">
                    <h2 className="max-w-xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
                        Set up once. It runs itself.
                    </h2>

                    <div className="mt-16 grid gap-10 sm:grid-cols-3">
                        {steps.map((step) => (
                            <div
                                key={step.n}
                                className="border-t border-zinc-800 pt-6"
                            >
                                <span className="font-mono text-sm text-zinc-500">
                                    {step.n}
                                </span>
                                <h3 className="mt-3 text-xl font-semibold text-white">
                                    {step.title}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                                    {step.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="bg-black">
                <div className="mx-auto max-w-6xl px-6 py-24 text-center">
                    <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                        Your income has no fixed address.
                        <br />
                        Your finances shouldn&apos;t either.
                    </h2>
                    <div className="mt-10 flex justify-center">
                        <Link
                            href="/signup"
                            className="rounded-2xl bg-white px-8 py-4 text-sm font-semibold text-black transition-all hover:bg-zinc-200 active:scale-[0.98]"
                        >
                            Get started free
                        </Link>
                    </div>
                    <p className="mt-4 text-sm text-zinc-500">
                        No credit card required.
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-zinc-800 bg-black">
                <div className="mx-auto max-w-6xl px-6 py-16">
                    <div className="flex flex-col justify-between gap-12 sm:flex-row">
                        <div>
                            <Logo />
                            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
                                Financial sovereignty for the modern digital nomad
                                and freelancer. One platform, no borders.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
                            <div>
                                <h4 className="text-sm font-semibold text-white">
                                    Product
                                </h4>
                                <ul className="mt-4 space-y-3 text-sm text-zinc-500">
                                    <li>Vaults</li>
                                    <li>Receivables</li>
                                    <li>Subscriptions</li>
                                    <li>Reports</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-white">
                                    Account
                                </h4>
                                <ul className="mt-4 space-y-3 text-sm">
                                    <li>
                                        <Link
                                            href="/login"
                                            className="text-zinc-500 hover:text-white transition-colors"
                                        >
                                            Log in
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/signup"
                                            className="text-zinc-500 hover:text-white transition-colors"
                                        >
                                            Sign up
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-white">
                                    Legal
                                </h4>
                                <ul className="mt-4 space-y-3 text-sm text-zinc-500">
                                    <li>Terms of Service</li>
                                    <li>Privacy Policy</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="mt-16 border-t border-zinc-800 pt-8 text-sm text-zinc-600">
                        © {new Date().getFullYear()} {APP_NAME}. Built for people
                        who work without borders.
                    </div>
                </div>
            </footer>
        </div>
    );
}
