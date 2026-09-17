"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus,
    ArrowUp,
    ArrowDown,
    ArrowsLeftRight,
    ArrowClockwise,
    Armchair,
    Bag,
    Book,
    GameController,
    MagnifyingGlass,
    Tag,
    Ticket,
    TShirt,
    House,
    Airplane,
    Desktop,
    ShoppingBag,
    Coffee,
    Heart,
    Car,
    UsersThree,
    HourglassMedium,
    DotsThree,
    CaretDown,
    CaretUp,
    Check,
} from "@phosphor-icons/react";
import { VaultCard } from "@/components/vaults/vault-card";
import { CreateVaultModal } from "@/components/vaults/create-vault-modal";
import { LimitBadge } from "@/components/plan/limit-badge";
import { UpgradeDialog } from "@/components/plan/upgrade-dialog";
import { usePlanLimit } from "@/hooks/use-plan-limit";
import { NewTransactionModal } from "@/components/vaults/new-transaction-modal";
import { TransactionEditModal } from "@/components/vaults/transaction-edit-modal";
import { SplitExpenseModal } from "@/components/social/split-expense-modal";
import { CurrencyToggle } from "@/components/shared/currency-toggle";
import { useCurrencyStore } from "@/stores/currency-store";
import { usePrivacyStore } from "@/stores/privacy-store";
import { CURRENCY_SYMBOLS, TRANSACTION_CATEGORIES } from "@/lib/constants";
import { getCategoryLabel } from "@/lib/transaction-categories";
import { createClient } from "@/lib/supabase/client";
import { convertTransactionAmount } from "@/lib/currency-helpers";
import { isLiquidVault, totalsByVault } from "@/lib/receivables";
import { useLanguageStore } from "@/stores/language-store";
import { useToastStore } from "@/stores/toast-store";
import type { Receivable, VaultType } from "@/types";

interface VaultData {
    id: string;
    name: string;
    currency: string;
    type: VaultType;
    is_protected: boolean;
    balance: number;
    is_shared?: boolean;
    isOwner?: boolean;
    // Only set for type === "receivable" — see totalsByVault().
    receivableCount?: number;
    receivableOverdueCount?: number;
}

interface PendingVaultInvite {
    memberId: string;
    vaultId: string;
    vaultName: string;
    ownerName: string;
}

interface TransactionData {
    id: string;
    vault_id: string;
    amount: number;
    type: string;
    category: string | null;
    description: string | null;
    date: string | null;
    original_currency: string;
    created_at: string;
    vault_name?: string;
    fee?: number | null;
    exchange_rate_at_time?: number | null;
}

const categoryIcons: Record<string, React.ElementType> = {
    Housing: House,
    Home: Armchair,
    Travel: Airplane,
    Tech: Desktop,
    Technology: Desktop,
    Shopping: ShoppingBag,
    Food: Coffee,
    Snacks: Coffee,
    Entertainment: Ticket,
    Sport: Heart,
    Tickets: Ticket,
    Clothing: TShirt,
    "Video Games": GameController,
    Accessories: Bag,
    Books: Book,
    Health: Heart,
    Wellness: Heart,
    Transport: Car,
};

export default function VaultsPage() {
    const supabase = createClient();
    const router = useRouter();
    const { displayCurrency, convert, loadRate, getActiveRate } = useCurrencyStore();
    const t = useLanguageStore((s) => s.t);
    const addToast = useToastStore((s) => s.addToast);
    const isPrivacyMode = usePrivacyStore((s) => s.isPrivacyMode);
    const symbol = CURRENCY_SYMBOLS[displayCurrency];

    const ACTIVITY_PAGE_SIZE = 10;

    const [vaults, setVaults] = useState<VaultData[]>([]);
    const [transactions, setTransactions] = useState<TransactionData[]>([]);
    const [pendingInvites, setPendingInvites] = useState<PendingVaultInvite[]>([]);
    const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activityError, setActivityError] = useState<string | null>(null);
    const [isLoadingMoreActivity, setIsLoadingMoreActivity] = useState(false);
    const [activityVisibleCount, setActivityVisibleCount] =
        useState(ACTIVITY_PAGE_SIZE);
    const [showCreateVault, setShowCreateVault] = useState(false);
    const [showNewTransaction, setShowNewTransaction] = useState(false);
    const [showVaultUpgrade, setShowVaultUpgrade] = useState(false);
    const vaultLimit = usePlanLimit("vault");
    const [selectedTx, setSelectedTx] = useState<TransactionData | null>(null);
    const [splitTarget, setSplitTarget] = useState<TransactionData | null>(null);
    const [activityFilter, setActivityFilter] = useState<
        "all" | "income" | "expense" | "transfer"
    >("all");
    const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
    const [categoryQuery, setCategoryQuery] = useState("");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    type VaultsVisibleLimit = 4 | 8 | 12 | "all";
    const DEFAULT_VAULTS_VISIBLE_LIMIT: VaultsVisibleLimit = 8;
    const STORAGE_KEY_VAULTS_LIMIT = "nomadix_vaults_visible_limit";

    const [visibleLimit, setVisibleLimit] = useState<VaultsVisibleLimit>(DEFAULT_VAULTS_VISIBLE_LIMIT);
    const [isExpanded, setIsExpanded] = useState(false);
    const [viewOptionsMenuOpen, setViewOptionsMenuOpen] = useState(false);
    const viewOptionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_VAULTS_LIMIT);
            if (saved === "4" || saved === "8" || saved === "12" || saved === "all") {
                setVisibleLimit(saved === "all" ? "all" : (Number(saved) as 4 | 8 | 12));
            }
        } catch {
            // Ignore localStorage errors
        }
    }, []);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                viewOptionsRef.current &&
                !viewOptionsRef.current.contains(e.target as Node)
            ) {
                setViewOptionsMenuOpen(false);
            }
        }
        if (viewOptionsMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [viewOptionsMenuOpen]);

    const handleSelectLimit = (limit: VaultsVisibleLimit) => {
        setVisibleLimit(limit);
        setIsExpanded(false);
        setViewOptionsMenuOpen(false);
        try {
            localStorage.setItem(STORAGE_KEY_VAULTS_LIMIT, String(limit));
        } catch {
            // Ignore localStorage errors
        }
    };

    const loadData = useCallback(async () => {
        setActivityError(null);
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();
        if (authError) {
            setActivityError("Unable to load activity. Please try again.");
            setIsLoading(false);
            return;
        }
        if (!user) {
            setIsLoading(false);
            return;
        }

        // Fetch vaults I own
        const { data: vaultRows, error: vaultError } = await supabase
            .from("vaults")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true });

        // Fetch all MY transactions
        const { data: txRows, error: txError } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        // Fetch open receivables. A receivable vault's "balance" is never a
        // transaction sum -- it's this, via totalsByVault() below.
        const { data: receivableRows } = await supabase
            .from("receivables")
            .select("*")
            .eq("user_id", user.id)
            .in("status", ["pending", "partial"]);

        if (vaultError || txError) {
            setActivityError("Unable to load activity. Please try again.");
        }

        // Shared vaults (Phase 3): a vault I co-own but don't own outright
        // never has user_id = me, so it is invisible to the queries above
        // even though RLS lets me read it. Find those via my active
        // memberships, then fetch each vault + its transactions
        // individually (not `.in()`) -- a person co-owns at most a
        // handful of vaults, so N+1 here is a deliberate, small trade-off
        // for not needing a dedicated RPC just to list them.
        const { data: memberRows } = await supabase
            .from("vault_members")
            .select("vault_id, status, role")
            .eq("user_id", user.id);

        const myOwnedIds = new Set((vaultRows || []).map((v) => v.id));
        const coOwnedVaultIds = (memberRows || [])
            .filter((m) => m.status === "active" && m.role === "member" && !myOwnedIds.has(m.vault_id))
            .map((m) => m.vault_id);

        const coOwnedVaults: typeof vaultRows = [];
        for (const vid of coOwnedVaultIds) {
            const { data: v } = await supabase.from("vaults").select("*").eq("id", vid).single();
            if (v) coOwnedVaults.push(v);
        }

        // Vaults I own outright that ARE shared still need the co-owner's
        // own transactions -- my `.eq("user_id", user.id)` query above
        // only ever returns rows I personally created.
        const ownedSharedIds = (vaultRows || [])
            .filter((v) => v.is_shared)
            .map((v) => v.id);

        const supplementalTx: typeof txRows = [];
        for (const vid of [...ownedSharedIds, ...coOwnedVaultIds]) {
            const { data } = await supabase
                .from("transactions")
                .select("*")
                .eq("vault_id", vid)
                .order("created_at", { ascending: false });
            if (data) supplementalTx.push(...data);
        }

        const allVaultRows = [...(vaultRows || []), ...coOwnedVaults];
        const seenTxIds = new Set<string>();
        const allTxRows = [...(txRows || []), ...supplementalTx].filter((tx) => {
            if (seenTxIds.has(tx.id)) return false;
            seenTxIds.add(tx.id);
            return true;
        });

        // Pending invites: vaults someone shared with me that I have not
        // answered yet. Read via RPC, not a direct `vaults` select -- RLS
        // only lets an ACTIVE member read the vault row, and an invite I
        // haven't answered yet is still 'invited', so a direct select
        // would silently return nothing for it.
        const { data: inviteRows } = await supabase.rpc(
            "nomadix_list_pending_vault_invites"
        );

        const invites: PendingVaultInvite[] = (
            (inviteRows || []) as {
                member_id: string;
                vault_id: string;
                vault_name: string;
                owner_name: string | null;
            }[]
        ).map((inv) => ({
            memberId: inv.member_id,
            vaultId: inv.vault_id,
            vaultName: inv.vault_name,
            ownerName: inv.owner_name || "",
        }));
        setPendingInvites(invites);

        // Build vault name lookup
        const vaultMap = new Map<string, string>();
        allVaultRows.forEach((v) => vaultMap.set(v.id, v.name));

        // Compute balances per vault
        const balanceMap = new Map<string, number>();
        allTxRows.forEach((tx) => {
            const prev = balanceMap.get(tx.vault_id) || 0;
            balanceMap.set(tx.vault_id, prev + Number(tx.amount));
        });

        const receivableTotalsMap = totalsByVault((receivableRows || []) as Receivable[]);

        const enrichedVaults: VaultData[] = allVaultRows.map((v) => {
            const vType = v.type as VaultType;
            const receivableEntry = receivableTotalsMap.get(v.id);
            return {
                id: v.id,
                name: v.name,
                currency: v.currency,
                type: vType,
                is_protected: v.is_protected,
                // A receivable vault's card "balance" is its outstanding
                // total, never a transactions sum.
                balance: vType === "receivable"
                    ? receivableEntry?.outstanding || 0
                    : balanceMap.get(v.id) || 0,
                is_shared: !!v.is_shared,
                isOwner: v.user_id === user.id,
                receivableCount: receivableEntry?.count,
                receivableOverdueCount: receivableEntry?.overdueCount,
            };
        });

        const enrichedTx: TransactionData[] = allTxRows.map((tx) => ({
            ...tx,
            amount: Number(tx.amount),
            vault_name: vaultMap.get(tx.vault_id) || "Unknown",
        }));

        setVaults(enrichedVaults);
        setTransactions(enrichedTx);
        setIsLoading(false);
    }, [supabase]);

    useEffect(() => {
        loadRate().then(() => loadData());
    }, [loadData, loadRate]);

    useEffect(() => {
        setActivityVisibleCount(ACTIVITY_PAGE_SIZE);
    }, [activityFilter, selectedCategories]);

    // Liquid total — what totalBalance has always meant. A receivable
    // vault's "balance" is money not yet in hand, so it must never enter
    // this sum. See isLiquidVault() in src/lib/receivables.ts.
    const totalBalance = vaults
        .filter((v) => isLiquidVault(v.type))
        .reduce((sum, v) => sum + convert(v.balance, v.currency as "EUR" | "USD"), 0);

    const pendingCollectionTotal = vaults
        .filter((v) => !isLiquidVault(v.type))
        .reduce((sum, v) => sum + convert(v.balance, v.currency as "EUR" | "USD"), 0);

    const pendingCollectionCount = vaults
        .filter((v) => !isLiquidVault(v.type))
        .reduce((sum, v) => sum + (v.receivableCount || 0), 0);

    const pendingCollectionOverdueCount = vaults
        .filter((v) => !isLiquidVault(v.type))
        .reduce((sum, v) => sum + (v.receivableOverdueCount || 0), 0);

    const projectedTotal = totalBalance + pendingCollectionTotal;

    const filteredByType =
        activityFilter === "all"
            ? transactions
            : transactions.filter((a) => a.type === activityFilter);

    const availableCategories = useMemo(() => {
        const fromData = Array.from(
            new Set(
                transactions
                    .map((t) => t.category)
                    .filter((c): c is string => !!c && c.trim().length > 0)
            )
        );
        const base = fromData.length > 0 ? fromData : [...TRANSACTION_CATEGORIES];
        return base.sort((a, b) => a.localeCompare(b));
    }, [transactions]);

    const filteredCategories = useMemo(() => {
        const q = categoryQuery.trim().toLowerCase();
        if (!q) return availableCategories;
        return availableCategories.filter((c) => c.toLowerCase().includes(q));
    }, [availableCategories, categoryQuery]);

    const filteredActivity = useMemo(() => {
        if (selectedCategories.length === 0) return filteredByType;
        const set = new Set(selectedCategories.map((c) => c.toLowerCase()));
        return filteredByType.filter((t) =>
            set.has((t.category || "").toLowerCase())
        );
    }, [filteredByType, selectedCategories]);

    const applyTransactionUpdate = (update: {
        id: string;
        amount?: number;
        type?: string;
        category?: string | null;
        description?: string | null;
        original_currency?: string;
        date?: string | null;
    }) => {
        setTransactions((prev) => {
            const existing = prev.find((t) => t.id === update.id);
            if (!existing) return prev;
            const next = prev.map((t) =>
                t.id === update.id
                    ? {
                        ...t,
                        ...update,
                        amount:
                            typeof update.amount === "number"
                                ? update.amount
                                : t.amount,
                    }
                    : t
            );
            const nextAmount =
                typeof update.amount === "number" ? update.amount : existing.amount;
            const delta = nextAmount - existing.amount;
            if (delta !== 0) {
                setVaults((vaultPrev) =>
                    vaultPrev.map((v) =>
                        v.id === existing.vault_id
                            ? { ...v, balance: v.balance + delta }
                            : v
                    )
                );
            }
            return next;
        });
    };

    const applyTransactionDelete = (id: string) => {
        setTransactions((prev) => {
            const existing = prev.find((t) => t.id === id);
            if (!existing) return prev;
            setVaults((vaultPrev) =>
                vaultPrev.map((v) =>
                    v.id === existing.vault_id
                        ? { ...v, balance: v.balance - existing.amount }
                        : v
                )
            );
            return prev.filter((t) => t.id !== id);
        });
    };

    const formatDate = (d: string | null) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    };

    const hasMoreActivity = activityVisibleCount < filteredActivity.length;

    const onLoadMoreActivity = () => {
        if (!hasMoreActivity || isLoadingMoreActivity) return;
        setIsLoadingMoreActivity(true);
        const next = Math.min(
            activityVisibleCount + ACTIVITY_PAGE_SIZE,
            filteredActivity.length
        );
        requestAnimationFrame(() => {
            setActivityVisibleCount(next);
            setIsLoadingMoreActivity(false);
        });
    };

    const respondToInvite = async (memberId: string, action: "accept" | "decline") => {
        setRespondingInviteId(memberId);
        const { error } = await supabase.rpc("nomadix_respond_vault_share", {
            p_member_id: memberId,
            p_action: action,
        });
        setRespondingInviteId(null);
        if (error) {
            addToast(error.message, "error");
            return;
        }
        addToast(t(action === "accept" ? "sharedVault.accepted" : "sharedVault.declined"));
        setPendingInvites((prev) => prev.filter((inv) => inv.memberId !== memberId));
        if (action === "accept") loadData();
    };

    if (isLoading) {
        return (
            <div className="p-6 lg:p-8 space-y-6">
                <div className="h-10 w-48 animate-pulse rounded-lg bg-accent" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="h-40 animate-pulse rounded-2xl bg-accent"
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        {t("vaults.myVaults")}
                    </h1>
                    {vaults.length > 0 && (
                        <span className="inline-flex items-center justify-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                            {vaults.length}
                        </span>
                    )}

                    {/* View Options (3-dots contextual menu) */}
                    {vaults.length > 0 && (
                        <div className="relative" ref={viewOptionsRef}>
                            <button
                                type="button"
                                onClick={() => setViewOptionsMenuOpen((prev) => !prev)}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                                    viewOptionsMenuOpen
                                        ? "border-border bg-accent text-foreground"
                                        : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
                                }`}
                                aria-label={t("vaults.viewOptions")}
                                title={t("vaults.viewOptions")}
                            >
                                <DotsThree size={20} weight="bold" />
                            </button>

                            <AnimatePresence>
                                {viewOptionsMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute left-0 top-9 z-40 w-56 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg"
                                    >
                                        <div className="border-b border-border/50 px-2.5 py-1.5">
                                            <p className="text-xs font-semibold text-foreground">
                                                {t("vaults.visibleLimitTitle")}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {t("vaults.visibleLimitDesc")}
                                            </p>
                                        </div>
                                        <div className="mt-1 space-y-0.5">
                                            {(
                                                [
                                                    { value: 4, label: t("vaults.optionOneRow"), badge: null },
                                                    { value: 8, label: t("vaults.optionTwoRows"), badge: t("vaults.defaultBadge") },
                                                    { value: 12, label: t("vaults.optionThreeRows"), badge: null },
                                                    { value: "all", label: t("vaults.optionAll"), badge: null },
                                                ] as const
                                            ).map((opt) => {
                                                const isSelected = visibleLimit === opt.value;
                                                return (
                                                    <button
                                                        key={String(opt.value)}
                                                        type="button"
                                                        onClick={() => handleSelectLimit(opt.value)}
                                                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                                                            isSelected
                                                                ? "bg-accent font-semibold text-foreground"
                                                                : "text-foreground/70 hover:bg-accent/60 hover:text-foreground"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span>{opt.label}</span>
                                                            {opt.badge && (
                                                                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                                                                    {opt.badge}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isSelected && (
                                                            <Check size={14} weight="bold" className="shrink-0 text-primary" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <CurrencyToggle />
                    <button
                        onClick={() => setShowNewTransaction(true)}
                        className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80 transition-all hover:bg-accent"
                    >
                        <ArrowsLeftRight size={16} />
                        {t("vaults.transaction")}
                    </button>
                    <button
                        onClick={() =>
                            vaultLimit.reached ? setShowVaultUpgrade(true) : setShowCreateVault(true)
                        }
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
                    >
                        <Plus size={16} weight="bold" />
                        {t("vaults.newVault")}
                        <LimitBadge entity="vault" className="bg-primary-foreground/15 text-primary-foreground" />
                    </button>
                </div>
            </div>

            {/* Pending shared-vault invites */}
            {pendingInvites.length > 0 && (
                <div className="mt-6 space-y-2">
                    {pendingInvites.map((inv) => (
                        <div
                            key={inv.memberId}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground/70">
                                    <UsersThree size={18} />
                                </div>
                                <p className="text-sm text-foreground">
                                    {t("sharedVault.pendingInvite", {
                                        name: inv.ownerName || "?",
                                        vault: inv.vaultName,
                                    })}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    onClick={() => respondToInvite(inv.memberId, "accept")}
                                    disabled={respondingInviteId === inv.memberId}
                                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {t("sharedVault.accept")}
                                </button>
                                <button
                                    onClick={() => respondToInvite(inv.memberId, "decline")}
                                    disabled={respondingInviteId === inv.memberId}
                                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:bg-accent disabled:opacity-50"
                                >
                                    {t("sharedVault.decline")}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Vault Cards Grid */}
            {(() => {
                const limitCount = visibleLimit === "all" ? vaults.length : visibleLimit;
                const isVaultsTruncated = visibleLimit !== "all" && vaults.length > limitCount;
                const displayedVaults = isExpanded || !isVaultsTruncated ? vaults : vaults.slice(0, limitCount);
                const hiddenVaultsCount = Math.max(0, vaults.length - limitCount);

                return (
                    <>
                        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            {displayedVaults.map((vault, i) => (
                                <motion.div
                                    key={vault.id}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                                >
                                    <VaultCard
                                        id={vault.id}
                                        name={vault.name}
                                        balance={vault.balance}
                                        currency={vault.currency}
                                        type={vault.type}
                                        isProtected={vault.is_protected}
                                        isShared={vault.is_shared}
                                        isOwner={vault.isOwner !== false}
                                        receivableCount={vault.receivableCount}
                                        receivableOverdueCount={vault.receivableOverdueCount}
                                        onClick={
                                            !isLiquidVault(vault.type)
                                                ? () => router.push(`/dashboard/receivables?vault=${vault.id}`)
                                                : undefined
                                        }
                                        onUpdated={loadData}
                                    />
                                </motion.div>
                            ))}
                        </div>

                        {/* Show More / Show Less Toggle Button */}
                        {isVaultsTruncated && (
                            <div className="mt-4 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setIsExpanded((prev) => !prev)}
                                    className="group flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground/80 shadow-xs transition-all hover:border-border/80 hover:bg-accent hover:text-foreground active:scale-[0.98]"
                                >
                                    <span>
                                        {isExpanded
                                            ? t("vaults.showLess")
                                            : t("vaults.showMore", { count: hiddenVaultsCount })}
                                    </span>
                                    {isExpanded ? (
                                        <CaretUp
                                            size={14}
                                            weight="bold"
                                            className="transition-transform group-hover:-translate-y-0.5"
                                        />
                                    ) : (
                                        <CaretDown
                                            size={14}
                                            weight="bold"
                                            className="transition-transform group-hover:translate-y-0.5"
                                        />
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                );
            })()}

            {/* Total */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="mt-4 rounded-xl border border-border bg-card px-5 py-3"
            >
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                        {t("vaults.totalAcrossAll")}
                    </span>
                    <span className={`text-lg font-bold text-foreground tabular-nums ${isPrivacyMode ? "blur-sm select-none" : ""}`}>
                        {symbol}
                        {totalBalance.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    </span>
                </div>

                {pendingCollectionTotal > 0 && (
                    <div className="mt-3 space-y-2 border-t border-dashed border-amber-200 pt-3 dark:border-amber-900/50">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                <HourglassMedium size={13} weight="bold" />
                                {t("vaults.pendingCollection")} · {t(
                                    pendingCollectionOverdueCount > 0
                                        ? "vaults.receivableAccountsOverdue"
                                        : "vaults.receivableAccountsCount",
                                    {
                                        count: pendingCollectionCount,
                                        overdue: pendingCollectionOverdueCount,
                                    }
                                )}
                            </span>
                            <span className={`text-sm font-semibold text-amber-700 tabular-nums dark:text-amber-400 ${isPrivacyMode ? "blur-sm select-none" : ""}`}>
                                + {symbol}
                                {pendingCollectionTotal.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                                {t("vaults.projectedTotal")}
                            </span>
                            <span className={`text-sm font-bold text-foreground tabular-nums ${isPrivacyMode ? "blur-sm select-none" : ""}`}>
                                {symbol}
                                {projectedTotal.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Recent Activity */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8"
            >
                {/* Activity Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl font-semibold text-foreground">
                        {t("vaults.recentActivity")}
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-border p-0.5">
                            {(
                                [
                                    { value: "all", label: t("vaults.filterAll") },
                                    { value: "income", label: t("vaults.filterIncome") },
                                    { value: "expense", label: t("vaults.filterExpense") },
                                    { value: "transfer", label: t("vaults.filterTransfer") },
                                ] as const
                            ).map((f) => (
                                <button
                                    key={f.value}
                                    onClick={() => setActivityFilter(f.value)}
                                    className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${activityFilter === f.value
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground/80"
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <button
                                type="button"
                                aria-label={t("vaults.filterByCategory")}
                                onClick={() =>
                                    setCategoryFilterOpen((v) => !v)
                                }
                                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-accent"
                            >
                                <Tag size={14} className="text-muted-foreground" />
                                {selectedCategories.length > 0
                                    ? t("vaults.categoriesCount", { count: selectedCategories.length })
                                    : t("vaults.categories")}
                            </button>

                            {categoryFilterOpen && (
                                <div className="absolute right-0 z-20 mt-2 w-[260px] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                                    <div className="border-b border-border p-3 space-y-2">
                                        <div className="flex items-center gap-2 rounded-xl border border-border bg-accent px-3 py-2">
                                            <MagnifyingGlass
                                                size={14}
                                                className="text-muted-foreground"
                                            />
                                            <input
                                                value={categoryQuery}
                                                onChange={(e) =>
                                                    setCategoryQuery(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder={t("vaults.search")}
                                                className="w-full bg-transparent text-sm text-foreground outline-none"
                                            />
                                        </div>
                                        {selectedCategories.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedCategories([]);
                                                    setCategoryQuery("");
                                                }}
                                                className="text-xs font-semibold text-muted-foreground hover:text-foreground/80"
                                            >
                                                {t("vaults.clearFilter")}
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-60 overflow-auto p-1">
                                        {filteredCategories.length === 0 ? (
                                            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                                {t("vaults.noResults")}
                                            </div>
                                        ) : (
                                            filteredCategories.map((c) => {
                                                const active =
                                                    selectedCategories
                                                        .map((x) =>
                                                            x.toLowerCase()
                                                        )
                                                        .includes(
                                                            c.toLowerCase()
                                                        );
                                                return (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedCategories(
                                                                (prev) => {
                                                                    const exists =
                                                                        prev
                                                                            .map(
                                                                                (
                                                                                    x
                                                                                ) =>
                                                                                    x.toLowerCase()
                                                                            )
                                                                            .includes(
                                                                                c.toLowerCase()
                                                                            );
                                                                    if (exists)
                                                                        return prev.filter(
                                                                            (x) =>
                                                                                x.toLowerCase() !==
                                                                                c.toLowerCase()
                                                                        );
                                                                    return [
                                                                        ...prev,
                                                                        c,
                                                                    ];
                                                                }
                                                            );
                                                        }}
                                                        className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${active
                                                            ? "bg-primary text-primary-foreground"
                                                            : "text-foreground/80 hover:bg-accent"
                                                            }`}
                                                    >
                                                        {getCategoryLabel(c, t)}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Activity Table */}
                <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
                    {/* Table Header */}
                    <div className="hidden sm:grid grid-cols-[80px_1fr_1fr_100px_120px] gap-4 border-b border-border px-5 py-3 text-xs font-semibold tracking-[0.1em] uppercase text-muted-foreground">
                        <span>{t("vaults.colDate")}</span>
                        <span>{t("vaults.colDescription")}</span>
                        <span>{t("vaults.colVault")}</span>
                        <span>{t("vaults.colCategory")}</span>
                        <span className="text-right">{t("vaults.colAmount")}</span>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-border">
                        {activityError ? (
                            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                                {activityError}
                            </div>
                        ) : filteredActivity.length === 0 ? (
                            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                                {t("vaults.noTransactionsFound")}
                            </div>
                        ) : (
                            filteredActivity
                                .slice(0, activityVisibleCount)
                                .map((item) => {
                                const isIncome = item.type === "income";
                                const isTransfer = item.type === "transfer";
                                const isAdjustment = item.type === "adjustment";
                                const IconCmp =
                                    categoryIcons[item.category || ""];
                                const currSymbol =
                                    CURRENCY_SYMBOLS[
                                    item.original_currency
                                    ] || "$";

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedTx(item)}
                                        className="flex items-center gap-3 px-5 py-3 sm:grid sm:grid-cols-[80px_1fr_1fr_100px_120px] sm:gap-4 text-sm transition-colors hover:bg-accent cursor-pointer"
                                    >
                                        <span className="hidden sm:block text-xs text-muted-foreground">
                                            {formatDate(
                                                item.date || item.created_at
                                            )}
                                        </span>
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:flex-none">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent">
                                                {IconCmp ? (
                                                    <IconCmp
                                                        size={14}
                                                        className="text-muted-foreground"
                                                    />
                                                ) : isTransfer ? (
                                                    <ArrowsLeftRight
                                                        size={14}
                                                        className="text-muted-foreground"
                                                    />
                                                ) : isAdjustment ? (
                                                    <ArrowClockwise
                                                        size={14}
                                                        className="text-muted-foreground"
                                                    />
                                                ) : isIncome ? (
                                                    <ArrowDown
                                                        size={14}
                                                        className="text-muted-foreground"
                                                    />
                                                ) : (
                                                    <ArrowUp
                                                        size={14}
                                                        className="text-muted-foreground"
                                                    />
                                                )}
                                            </div>
                                            <span className="truncate font-medium text-foreground">
                                                {item.description || item.type}
                                            </span>
                                            {!isTransfer && !isAdjustment && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSplitTarget(item);
                                                    }}
                                                    title={t("split.action")}
                                                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-card hover:text-foreground"
                                                >
                                                    <UsersThree size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <span className="hidden sm:block text-muted-foreground truncate">
                                            {item.vault_name}
                                        </span>
                                        <span className="hidden sm:block text-xs text-muted-foreground">
                                            {item.category ? getCategoryLabel(item.category, t) : "—"}
                                        </span>
                                        <span
                                            className={`text-right font-semibold tabular-nums ${isIncome
                                                ? "text-emerald-600"
                                                : isTransfer
                                                    ? "text-muted-foreground"
                                                    : "text-foreground"
                                                }`}
                                        >
                                            {item.amount > 0 ? "+" : ""}
                                            {symbol}
                                            {Math.abs(
                                                convertTransactionAmount(
                                                    item.amount,
                                                    (item.original_currency || "USD") as "EUR" | "USD",
                                                    displayCurrency,
                                                    item.exchange_rate_at_time,
                                                    getActiveRate()
                                                )
                                            ).toLocaleString("en-US", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {!activityError && filteredActivity.length > 0 && (
                    <div className="mt-4 flex justify-center">
                        {hasMoreActivity ? (
                            <button
                                type="button"
                                onClick={onLoadMoreActivity}
                                disabled={isLoadingMoreActivity}
                                className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80 transition-all hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isLoadingMoreActivity
                                    ? t("vaults.loading")
                                    : t("vaults.loadMore")}
                            </button>
                        ) : (
                            <span className="text-sm text-muted-foreground">
                                {t("vaults.noMore")}
                            </span>
                        )}
                    </div>
                )}
            </motion.div>

            {/* Modals */}
            <CreateVaultModal
                isOpen={showCreateVault}
                onClose={() => setShowCreateVault(false)}
                onCreated={loadData}
            />
            <UpgradeDialog
                isOpen={showVaultUpgrade}
                onClose={() => setShowVaultUpgrade(false)}
                reason="vault"
            />
            <NewTransactionModal
                isOpen={showNewTransaction}
                onClose={() => setShowNewTransaction(false)}
                onCreated={loadData}
                vaults={vaults
                    .filter((v) => isLiquidVault(v.type))
                    .map((v) => ({
                        id: v.id,
                        name: v.name,
                        currency: v.currency,
                    }))}
            />
            <TransactionEditModal
                isOpen={!!selectedTx}
                onClose={() => setSelectedTx(null)}
                onUpdated={(tx) => {
                    applyTransactionUpdate(tx);
                    setSelectedTx((prev) => (prev && prev.id === tx.id ? { ...prev, ...tx } : prev));
                }}
                onDeleted={(id) => {
                    applyTransactionDelete(id);
                    setSelectedTx(null);
                }}
                transaction={selectedTx}
            />
            {splitTarget && (
                <SplitExpenseModal
                    isOpen={!!splitTarget}
                    onClose={() => setSplitTarget(null)}
                    transaction={{
                        id: splitTarget.id,
                        amount: splitTarget.amount,
                        original_currency: splitTarget.original_currency,
                        description: splitTarget.description,
                    }}
                    onSplit={loadData}
                />
            )}
        </div>
    );
}
