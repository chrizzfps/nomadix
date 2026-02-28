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
    "Entertainment",
    "Health",
    "Education",
    "Freelance",
    "Salary",
    "Investment",
    "Transfer",
    "Other",
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
    { href: "/dashboard/identity", label: "Identity", icon: "IdentificationCard" },
    { href: "/dashboard/travel", label: "Travel", icon: "Airplane" },
] as const;
