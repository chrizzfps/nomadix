// ============================================
// Nomadix Type Definitions
// ============================================

export type Currency = "EUR" | "USD";

export type VaultType = "savings" | "checking" | "cash";

export type TransactionType = "income" | "expense" | "transfer";

export type TransactionStatus = "completed" | "pending" | "failed";

export type DocumentType =
    | "passport"
    | "residency"
    | "license"
    | "visa"
    | "insurance"
    | "other";

// ============================================
// Database Row Types
// ============================================

export interface UserProfile {
    id: string;
    full_name: string;
    avatar_url: string | null;
    base_currency: Currency;
    timezone: string;
    emergency_contact: string | null;
    social_links: Record<string, string>;
    is_onboarded: boolean;
    created_at: string;
    updated_at: string;
}

export interface Vault {
    id: string;
    user_id: string;
    name: string;
    currency: Currency;
    type: VaultType;
    icon: string;
    color: string;
    is_protected: boolean;
    created_at: string;
    updated_at: string;
}

export interface Transaction {
    id: string;
    user_id: string;
    vault_id: string;
    amount: number;
    type: TransactionType;
    original_currency: Currency;
    exchange_rate_at_time: number;
    category: string | null;
    description: string | null;
    date: string;
    status: TransactionStatus;
    created_at: string;
}

export interface Document {
    id: string;
    user_id: string;
    title: string;
    type: DocumentType;
    file_url: string;
    expiry_date: string | null;
    notes: string | null;
    created_at: string;
}

export interface Trip {
    id: string;
    user_id: string;
    destination_name: string;
    start_date: string | null;
    end_date: string | null;
    total_budget: number | null;
    currency: Currency;
    created_at: string;
}

export interface TripItinerary {
    id: string;
    trip_id: string;
    day_number: number;
    title: string | null;
    description: string | null;
    estimated_cost: number | null;
}

// ============================================
// Extended types (with relations)
// ============================================

export interface VaultWithBalance extends Vault {
    balance: number;
}

export interface TransactionWithVault extends Transaction {
    vault: Pick<Vault, "name" | "currency" | "icon">;
}

export interface AccessLogEntry {
    id: string;
    action: "viewed" | "downloaded" | "shared" | "uploaded";
    document_title: string;
    document_type: DocumentType;
    timestamp: string;
    device: string;
}
