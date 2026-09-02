// ============================================
// Nomadix Constants
// ============================================

export const APP_NAME = "Nomadix";
export const APP_DESCRIPTION =
    "Financial sovereignty and lifestyle management for the modern digital nomad.";
export const APP_TAGLINE = "The new standard for global living.";

// Currency
export const SUPPORTED_CURRENCIES = ["EUR", "USD"] as const;
export const CURRENCY_SYMBOLS: Record<string, string> = {
    EUR: "€",
    USD: "$",
};

// Vault types
export const VAULT_TYPES = [
    { value: "savings", label: "Savings" },
    { value: "checking", label: "Checking" },
    { value: "cash", label: "Cash" },
] as const;

// Transaction categories
export const TRANSACTION_CATEGORIES = [
    "Housing",
    "Food",
    "Transport",
    "Travel",
    "Tech",
    "Technology",
    "Entertainment",
    "Sport",
    "Tickets",
    "Health",
    "Wellness",
    "Education",
    "Books",
    "Freelance",
    "Salary",
    "Investment",
    "Transfer",
    "Other",
    "Shopping",
    "Clothing",
    "Video Games",
    "Snacks",
    "Accessories",
    "Home",
] as const;

// Document types
export const DOCUMENT_TYPES = [
    { value: "passport", label: "Passport" },
    { value: "residency", label: "Residency (TIE)" },
    { value: "license", label: "License" },
    { value: "visa", label: "Visa" },
    { value: "insurance", label: "Insurance" },
    { value: "other", label: "Other" },
] as const;

// Navigation items
export const NAV_ITEMS = [
    { href: "/dashboard", label: "Dashboard", icon: "SquaresFour" },
    { href: "/dashboard/vaults", label: "Vaults", icon: "Vault" },
    { href: "/dashboard/expenses", label: "Expenses", icon: "Receipt" },
    { href: "/dashboard/subscriptions", label: "Subscriptions", icon: "ArrowsClockwise" },
    { href: "/dashboard/reports", label: "Reports", icon: "Sparkle" },
    { href: "/dashboard/identity", label: "Identity", icon: "IdentificationCard" },
    { href: "/dashboard/travel", label: "Travel", icon: "Airplane" },
] as const;

// Subscriptions & recurring payments
export const BILLING_CYCLES = [
    { value: "weekly", label: "Weekly" },
    { value: "biweekly", label: "Every 2 weeks" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "semiannual", label: "Every 6 months" },
    { value: "yearly", label: "Yearly" },
    { value: "custom_days", label: "Custom (N days)" },
] as const;

export const SUBSCRIPTION_STATUSES = [
    { value: "active", label: "Active" },
    { value: "paused", label: "Paused" },
    { value: "canceled", label: "Canceled" },
    { value: "ended", label: "Ended" },
] as const;

export const SUBSCRIPTION_FEE_MODES = [
    { value: "none", label: "No fee" },
    { value: "fixed", label: "Fixed amount" },
    { value: "percent", label: "Percentage" },
] as const;
