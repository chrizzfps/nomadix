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
    exchange_rate_at_time: number | null;
    category: string | null;
    description: string | null;
    date: string;
    status: TransactionStatus;
    created_at: string;
    fee: number | null;
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

// ============================================
// Subscriptions & Recurring Payments
// ============================================

export type SubscriptionDirection = "expense" | "income";

export type BillingCycle =
    | "weekly"
    | "biweekly"
    | "monthly"
    | "quarterly"
    | "semiannual"
    | "yearly"
    | "custom_days";

export type SubscriptionStatus = "active" | "paused" | "canceled" | "ended";

export type SubscriptionFeeMode = "none" | "fixed" | "percent";

export type OccurrenceStatus =
    | "pending"
    | "charged"
    | "skipped"
    | "failed"
    | "canceled";

export interface Subscription {
    id: string;
    user_id: string;
    vault_id: string;
    name: string;
    merchant: string | null;
    description: string | null;
    category: string | null;
    icon_key: string | null;
    color: string;
    cancel_url: string | null;
    notes: string | null;
    direction: SubscriptionDirection;
    amount: number;
    currency: Currency;
    is_variable_amount: boolean;
    fee_mode: SubscriptionFeeMode;
    fee_value: number;
    billing_cycle: BillingCycle;
    interval_count: number;
    custom_interval_days: number | null;
    anchor_day: number | null;
    start_date: string;
    end_date: string | null;
    next_due_date: string;
    last_charged_date: string | null;
    trial_end_date: string | null;
    trial_amount: number;
    status: SubscriptionStatus;
    auto_charge: boolean;
    canceled_at: string | null;
    reminder_days_before: number;
    notify_in_app: boolean;
    notify_email: boolean;
    last_reminder_seen_at: string | null;
    last_email_sent_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface SubscriptionOccurrence {
    id: string;
    subscription_id: string;
    user_id: string;
    due_date: string;
    status: OccurrenceStatus;
    expected_amount: number;
    actual_amount: number | null;
    fee_amount: number;
    currency: Currency;
    exchange_rate_at_time: number | null;
    transaction_id: string | null;
    charged_at: string | null;
    failure_reason: string | null;
    notes: string | null;
    is_trial: boolean;
    created_at: string;
    updated_at: string;
}

export interface SubscriptionPriceChange {
    id: string;
    subscription_id: string;
    user_id: string;
    old_amount: number;
    new_amount: number;
    currency: Currency;
    source: "manual" | "charge";
    note: string | null;
    changed_at: string;
}

export interface SubscriptionWithVault extends Subscription {
    vault: Pick<Vault, "name" | "currency" | "icon">;
}
