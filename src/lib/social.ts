// ============================================
// Social layer — pure logic
// ============================================
//
// Client-side mirrors of the checks the database enforces for real. Every
// function here is UX only — it lets a form show an error before a round
// trip, never a substitute for the server-side check. The database is
// always the source of truth (see supabase/schema.sql, "SOCIAL LAYER").
//
// USERNAME_PATTERN and FRIEND_CODE_PATTERN are EXACT mirrors of the CHECK
// constraints `users_profile_username_format` / `_friend_code_format` in
// supabase/schema.sql. If you change one, change the other.

import type {
    Currency,
    FriendSummary,
    FriendshipDirection,
    FriendshipStatus,
    VaultTransferPolicy,
} from "@/types";

// ============================================
// Username
// ============================================

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

// Mirrors the reserved list in nomadix_set_username(). Kept in sync by hand
// — there is no shared source, so update both places together.
export const RESERVED_USERNAMES = new Set([
    "admin",
    "nomadix",
    "support",
    "api",
    "me",
    "settings",
    "root",
    "system",
    "null",
    "undefined",
    "friends",
]);

export function normalizeUsername(input: string): string {
    return input.trim().toLowerCase();
}

export function validateUsername(input: string): string | null {
    const normalized = normalizeUsername(input);
    if (!USERNAME_PATTERN.test(normalized)) {
        return "3-20 characters: letters, numbers, underscore.";
    }
    if (RESERVED_USERNAMES.has(normalized)) {
        return "That username is reserved.";
    }
    return null;
}

const USERNAME_COOLDOWN_DAYS = 30;

// Mirrors the 30-day cooldown nomadix_set_username() enforces server-side.
// Returns 0 when the user is free to change it now.
export function usernameCooldownDaysRemaining(
    usernameChangedAt: string | null,
    now: Date = new Date()
): number {
    if (!usernameChangedAt) return 0;
    const changedAt = new Date(usernameChangedAt).getTime();
    if (Number.isNaN(changedAt)) return 0;
    const cooldownEnds = changedAt + USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    const remainingMs = cooldownEnds - now.getTime();
    if (remainingMs <= 0) return 0;
    return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

// ============================================
// Friend code
// ============================================

// NMDX-XXXX, alphabet excludes I/O/0/1 so a code can never be misread
// aloud — see nomadix_new_friend_code() in supabase/schema.sql.
export const FRIEND_CODE_PATTERN = /^NMDX-[0-9A-HJ-NP-Z]{4}$/i;

export function normalizeFriendCode(input: string): string {
    return input.trim().toUpperCase();
}

export function isValidFriendCode(input: string): boolean {
    return FRIEND_CODE_PATTERN.test(normalizeFriendCode(input));
}

export function formatFriendCode(code: string): string {
    return normalizeFriendCode(code);
}

// ============================================
// Friend display
// ============================================

// The single place that decides what to call a friend in the UI — a
// username first (it's the identity you searched for), full name as a
// fallback for the rare case a profile is friend-visible without one.
export function formatFriendHandle(friend: Pick<FriendSummary, "username" | "full_name">): string {
    if (friend.username) return `@${friend.username}`;
    return friend.full_name || "Nomad";
}

export function friendInitials(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// ============================================
// Friend list grouping/sorting for the Friends screen
// ============================================

export interface FriendGroups {
    incomingRequests: FriendSummary[];
    outgoingRequests: FriendSummary[];
    friends: FriendSummary[];
}

// Mirrors the ordering nomadix_list_friends() already applies (pending
// before accepted) but splits pending by direction, which the SQL result
// set does not need to distinguish for its own ordering.
export function groupFriendSummaries(rows: FriendSummary[]): FriendGroups {
    const incomingRequests: FriendSummary[] = [];
    const outgoingRequests: FriendSummary[] = [];
    const friends: FriendSummary[] = [];

    for (const row of rows) {
        if (row.status === "pending") {
            if (row.direction === "incoming") incomingRequests.push(row);
            else outgoingRequests.push(row);
        } else if (row.status === "accepted") {
            friends.push(row);
        }
        // "blocked"/"declined" rows are not surfaced in any of the three
        // lists — nomadix_list_friends() already hides blocks from the
        // blocked party, and a declined request has nothing left to show.
    }

    return { incomingRequests, outgoingRequests, friends };
}

export function friendshipStatusLabel(
    status: FriendshipStatus | "none",
    direction?: FriendshipDirection
): "none" | "pending_outgoing" | "pending_incoming" | "friends" | "blocked" {
    if (status === "accepted") return "friends";
    if (status === "blocked") return "blocked";
    if (status === "pending") {
        return direction === "incoming" ? "pending_incoming" : "pending_outgoing";
    }
    return "none";
}

// ============================================
// Phase 2 — transfer ledger + per-vault privacy
// ============================================

// Client-side FX preview only — EXACT mirror of the conversion branch in
// nomadix_send_transfer() (supabase/schema.sql). The server always
// recomputes and freezes the real value; this only lets the Send modal
// show "they'll receive ~X" before the round trip.
export function previewTransferConversion(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency,
    usdToEurRate: number
): number {
    if (fromCurrency === toCurrency) return round2(amount);
    return fromCurrency === "USD"
        ? round2(amount * usdToEurRate) // USD -> EUR
        : round2(amount / usdToEurRate); // EUR -> USD
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export interface ReversalWindow {
    /** True once reversible_until has passed, or there is no window at all. */
    expired: boolean;
    /** Whole hours left, floor()'d — 0 in the final hour. */
    hoursLeft: number;
    /** Whole minutes left within the current hour. */
    minutesLeft: number;
}

// Mirrors the 24h window nomadix_send_transfer() stamps on a friend
// transfer (`reversible_until`). `null` means the transfer was never
// reversible in the first place (internal/settlement/reversal kinds).
export function reversalWindowRemaining(
    reversibleUntil: string | null,
    now: Date = new Date()
): ReversalWindow {
    if (!reversibleUntil) return { expired: true, hoursLeft: 0, minutesLeft: 0 };
    const remainingMs = new Date(reversibleUntil).getTime() - now.getTime();
    if (remainingMs <= 0) return { expired: true, hoursLeft: 0, minutesLeft: 0 };
    const totalMinutes = Math.floor(remainingMs / 60000);
    return {
        expired: false,
        hoursLeft: Math.floor(totalMinutes / 60),
        minutesLeft: totalMinutes % 60,
    };
}

export const VAULT_TRANSFER_POLICIES: VaultTransferPolicy[] = ["nobody", "friends", "allowlist"];

// Whichever side of a transfer the current viewer is on, phrased for a
// single-column activity feed.
export function transferDirectionLabel(
    transfer: { sender_user_id: string; kind: string },
    viewerId: string
): "sent" | "received" {
    return transfer.sender_user_id === viewerId ? "sent" : "received";
}
