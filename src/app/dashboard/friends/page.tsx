"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
    UsersThree,
    UserPlus,
    Copy,
    Check,
    ShieldWarning,
    ProhibitInset,
    X,
    PaperPlaneTilt,
    ArrowDownLeft,
    ArrowUpRight,
    ClockCounterClockwise,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
import { AddFriendModal } from "@/components/social/add-friend-modal";
import { SendTransferModal } from "@/components/social/send-transfer-modal";
import {
    friendInitials,
    formatFriendHandle,
    groupFriendSummaries,
    reversalWindowRemaining,
    transferDirectionLabel,
} from "@/lib/social";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import type { FriendSummary, Transfer } from "@/types";

type Tab = "friends" | "requests" | "balances";

export default function FriendsPage() {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);
    const formatDate = useLanguageStore((s) => s.formatDate);

    const [isLoading, setIsLoading] = useState(true);
    const [friends, setFriends] = useState<FriendSummary[]>([]);
    const [friendCode, setFriendCode] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>("friends");
    const [showAddFriend, setShowAddFriend] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [returningId, setReturningId] = useState<string | null>(null);
    const [sendTarget, setSendTarget] = useState<FriendSummary | null>(null);
    // Set when a remove/block was refused for having a non-zero net
    // balance — the RPC's outstanding-balance error becomes an inline
    // "remove anyway" offer instead of a dead-end toast.
    const [forceCandidate, setForceCandidate] = useState<{
        friendshipId: string;
        action: "remove" | "block";
    } | null>(null);

    const loadData = useCallback(async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const [
            { data: rows, error: friendsError },
            { data: profile },
            { data: transferRows, error: transfersError },
        ] = await Promise.all([
            supabase.rpc("nomadix_list_friends"),
            supabase.from("users_profile").select("friend_code").eq("id", user.id).single(),
            supabase
                .from("transfers")
                .select("*")
                .or(`sender_user_id.eq.${user.id},recipient_user_id.eq.${user.id}`)
                .order("created_at", { ascending: false })
                .limit(15),
        ]);

        if (friendsError) {
            addToast(friendsError.message, "error");
        } else {
            setFriends((rows as FriendSummary[]) || []);
        }
        if (transfersError) {
            addToast(transfersError.message, "error");
        } else {
            setTransfers((transferRows as Transfer[]) || []);
        }
        setFriendCode(profile?.friend_code ?? null);
        setIsLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const groups = groupFriendSummaries(friends);
    const requestCount = groups.incomingRequests.length + groups.outgoingRequests.length;

    const respond = async (
        friendshipId: string,
        action: "accept" | "decline" | "remove" | "block",
        force = false
    ) => {
        setBusyId(friendshipId);
        const { error } = await supabase.rpc("nomadix_respond_friend_request", {
            p_friendship_id: friendshipId,
            p_action: action,
            p_force: force,
        });
        setBusyId(null);

        if (error) {
            if (
                (action === "remove" || action === "block") &&
                !force &&
                /outstanding balance/i.test(error.message)
            ) {
                setForceCandidate({ friendshipId, action });
                addToast(t("friends.outstandingBalance"), "error");
                return;
            }
            addToast(error.message || t("friends.actionFailed"), "error");
            return;
        }

        setForceCandidate(null);
        loadData();
    };

    const handleReturn = async (transferId: string) => {
        setReturningId(transferId);
        const { error } = await supabase.rpc("nomadix_reverse_transfer", { p_transfer_id: transferId });
        setReturningId(null);
        if (error) {
            addToast(error.message || t("transfer.returnFailed"), "error");
            return;
        }
        addToast(t("transfer.returned"));
        loadData();
    };

    const copyFriendCode = async () => {
        if (!friendCode) return;
        try {
            await navigator.clipboard.writeText(friendCode);
            setCodeCopied(true);
            addToast(t("socialPrivacy.friendCodeCopied"));
            setTimeout(() => setCodeCopied(false), 2000);
        } catch {
            addToast(t("friends.actionFailed"), "error");
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-3xl space-y-6 p-4 pb-24 lg:p-8"
        >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                        <UsersThree size={20} className="text-foreground/70" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">{t("friends.title")}</h1>
                        <p className="text-xs text-muted-foreground">{t("friends.subtitle")}</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAddFriend(true)}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                    <UserPlus size={16} weight="bold" />
                    {t("friends.sendRequest")}
                </button>
            </div>

            {/* Your identity */}
            {friendCode && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                            {t("socialPrivacy.friendCodeLabel")}
                        </p>
                        <p className="mt-1 font-mono text-base font-semibold text-foreground">{friendCode}</p>
                    </div>
                    <button
                        onClick={copyFriendCode}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground/80 transition-colors hover:bg-accent"
                    >
                        {codeCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        {t(codeCopied ? "socialPrivacy.friendCodeCopied" : "socialPrivacy.friendCodeCopy")}
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
                {(
                    [
                        { key: "friends" as const, label: t("friends.tabFriends"), badge: groups.friends.length },
                        { key: "requests" as const, label: t("friends.tabRequests"), badge: requestCount },
                        { key: "balances" as const, label: t("friends.tabBalances"), badge: 0 },
                    ]
                ).map((tabItem) => (
                    <button
                        key={tabItem.key}
                        onClick={() => setTab(tabItem.key)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                            tab === tabItem.key
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent"
                        }`}
                    >
                        {tabItem.label}
                        {tabItem.badge > 0 && (
                            <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                    tab === tabItem.key
                                        ? "bg-primary-foreground/20 text-primary-foreground"
                                        : "bg-accent text-foreground/70"
                                }`}
                            >
                                {tabItem.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="space-y-3">
                    <div className="h-16 animate-pulse rounded-2xl bg-accent" />
                    <div className="h-16 animate-pulse rounded-2xl bg-accent" />
                </div>
            ) : tab === "friends" ? (
                groups.friends.length === 0 ? (
                    <EmptyState
                        title={t("friends.noFriendsYet")}
                        description={t("friends.noFriendsYetDesc")}
                    />
                ) : (
                    <div className="space-y-3">
                        {groups.friends.map((friend) => (
                            <FriendRow
                                key={friend.friendship_id}
                                friend={friend}
                                sinceLabel={t("friends.since", { date: formatDate(friend.since) })}
                                busy={busyId === friend.friendship_id}
                                forceOffered={forceCandidate?.friendshipId === friend.friendship_id}
                                onRemove={() => respond(friend.friendship_id, "remove")}
                                onForceRemove={() => respond(friend.friendship_id, "remove", true)}
                                onBlock={() => respond(friend.friendship_id, "block")}
                                onSend={() => setSendTarget(friend)}
                                sendLabel={t("transfer.send")}
                                labels={{
                                    remove: t("friends.remove"),
                                    block: t("friends.block"),
                                    forceRemove: t("friends.forceRemove"),
                                    confirmRemove: t("friends.confirmRemove"),
                                }}
                            />
                        ))}
                    </div>
                )
            ) : tab === "requests" ? (
                requestCount === 0 ? (
                    <EmptyState title={t("friends.noRequests")} description="" />
                ) : (
                    <div className="space-y-6">
                        {groups.incomingRequests.length > 0 && (
                            <RequestGroup
                                title={t("friends.incomingRequests")}
                                rows={groups.incomingRequests}
                                busyId={busyId}
                                renderActions={(row) => (
                                    <>
                                        <button
                                            onClick={() => respond(row.friendship_id, "accept")}
                                            disabled={busyId === row.friendship_id}
                                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
                                        >
                                            {t("friends.accept")}
                                        </button>
                                        <button
                                            onClick={() => respond(row.friendship_id, "decline")}
                                            disabled={busyId === row.friendship_id}
                                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:bg-accent disabled:opacity-50"
                                        >
                                            {t("friends.decline")}
                                        </button>
                                    </>
                                )}
                            />
                        )}
                        {groups.outgoingRequests.length > 0 && (
                            <RequestGroup
                                title={t("friends.outgoingRequests")}
                                rows={groups.outgoingRequests}
                                busyId={busyId}
                                renderActions={(row) => (
                                    <button
                                        onClick={() => respond(row.friendship_id, "decline")}
                                        disabled={busyId === row.friendship_id}
                                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:bg-accent disabled:opacity-50"
                                    >
                                        {t("friends.cancelRequest")}
                                    </button>
                                )}
                            />
                        )}
                    </div>
                )
            ) : (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                    <p className="text-sm text-muted-foreground">{t("friends.balancesComingSoon")}</p>
                </div>
            )}

            {/* Recent transfers */}
            {!isLoading && transfers.length > 0 && userId && (
                <div className="space-y-3">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                        <ClockCounterClockwise size={14} />
                        {t("transfer.recentTitle")}
                    </h3>
                    <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
                        {transfers.map((tr) => (
                            <TransferRow
                                key={tr.id}
                                transfer={tr}
                                userId={userId}
                                friends={friends}
                                isReturning={returningId === tr.id}
                                onReturn={() => handleReturn(tr.id)}
                                t={t}
                            />
                        ))}
                    </div>
                </div>
            )}

            <AddFriendModal
                isOpen={showAddFriend}
                onClose={() => setShowAddFriend(false)}
                onRequestSent={loadData}
            />

            {sendTarget && (
                <SendTransferModal
                    isOpen={!!sendTarget}
                    onClose={() => setSendTarget(null)}
                    friend={{
                        friend_id: sendTarget.friend_id,
                        username: sendTarget.username,
                        full_name: sendTarget.full_name,
                    }}
                    onSent={loadData}
                />
            )}
        </motion.div>
    );
}

function EmptyState({ title, description }: { title: string; description: string }) {
    return (
        <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center shadow-sm">
            <UsersThree size={32} weight="thin" className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{title}</p>
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
    );
}

function RequestGroup({
    title,
    rows,
    busyId,
    renderActions,
}: {
    title: string;
    rows: FriendSummary[];
    busyId: string | null;
    renderActions: (row: FriendSummary) => ReactNode;
}) {
    return (
        <div className="space-y-3">
            <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                {title}
            </h3>
            <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
                {rows.map((row) => (
                    <div key={row.friendship_id} className="flex items-center justify-between gap-3 p-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                {friendInitials(row.full_name || row.username || "?")}
                            </div>
                            <p className="truncate text-sm font-medium text-foreground">
                                {formatFriendHandle(row)}
                            </p>
                        </div>
                        <div
                            className={`flex shrink-0 items-center gap-2 ${
                                busyId === row.friendship_id ? "opacity-50" : ""
                            }`}
                        >
                            {renderActions(row)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FriendRow({
    friend,
    sinceLabel,
    busy,
    forceOffered,
    onRemove,
    onForceRemove,
    onBlock,
    onSend,
    sendLabel,
    labels,
}: {
    friend: FriendSummary;
    sinceLabel: string;
    busy: boolean;
    forceOffered: boolean;
    onRemove: () => void;
    onForceRemove: () => void;
    onBlock: () => void;
    onSend: () => void;
    sendLabel: string;
    labels: { remove: string; block: string; forceRemove: string; confirmRemove: string };
}) {
    const [confirming, setConfirming] = useState(false);

    return (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                        {friendInitials(friend.full_name || friend.username || "?")}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                            {formatFriendHandle(friend)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{sinceLabel}</p>
                    </div>
                </div>

                {!confirming ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                        <button
                            onClick={onSend}
                            disabled={busy}
                            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
                        >
                            <PaperPlaneTilt size={14} weight="bold" />
                            {sendLabel}
                        </button>
                        <button
                            onClick={() => setConfirming(true)}
                            disabled={busy}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive disabled:opacity-50"
                            aria-label={labels.remove}
                        >
                            <X size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="flex shrink-0 items-center gap-1.5">
                        <button
                            onClick={onBlock}
                            disabled={busy}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                            aria-label={labels.block}
                            title={labels.block}
                        >
                            <ProhibitInset size={16} />
                        </button>
                        <button
                            onClick={onRemove}
                            disabled={busy}
                            className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                        >
                            {labels.remove}
                        </button>
                        <button
                            onClick={() => setConfirming(false)}
                            className="rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-foreground/70 hover:bg-accent"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            {forceOffered && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="flex items-center gap-2">
                        <ShieldWarning size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                            {labels.confirmRemove}
                        </p>
                    </div>
                    <button
                        onClick={onForceRemove}
                        disabled={busy}
                        className="shrink-0 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                    >
                        {labels.forceRemove}
                    </button>
                </div>
            )}
        </div>
    );
}

function TransferRow({
    transfer,
    userId,
    friends,
    isReturning,
    onReturn,
    t,
}: {
    transfer: Transfer;
    userId: string;
    friends: FriendSummary[];
    isReturning: boolean;
    onReturn: () => void;
    t: (key: string, vars?: Record<string, string | number>) => string;
}) {
    const direction = transferDirectionLabel(transfer, userId);
    const otherUserId = direction === "sent" ? transfer.recipient_user_id : transfer.sender_user_id;
    const other = friends.find((f) => f.friend_id === otherUserId);
    const name = other ? formatFriendHandle(other) : "…";

    const isMine = direction === "sent";
    const amount = isMine ? transfer.amount_sent + transfer.fee : transfer.amount_received;
    const currency = isMine ? transfer.sent_currency : transfer.received_currency;
    const symbol = CURRENCY_SYMBOLS[currency] ?? "";

    const canReturn =
        direction === "received" &&
        transfer.kind === "friend" &&
        transfer.status === "completed";
    const reversal = canReturn ? reversalWindowRemaining(transfer.reversible_until) : null;

    return (
        <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
                <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        isMine ? "bg-accent text-foreground/70" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}
                >
                    {isMine ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                        {t(isMine ? "transfer.sentTo" : "transfer.receivedFrom", { name })}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                        {transfer.status === "reversed"
                            ? t("transfer.reversedBadge")
                            : reversal && !reversal.expired
                              ? t("transfer.reversibleFor", { hours: reversal.hoursLeft, minutes: reversal.minutesLeft })
                              : new Date(transfer.created_at).toLocaleDateString()}
                    </p>
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                <span
                    className={`text-sm font-semibold ${
                        isMine ? "text-foreground" : "text-emerald-600 dark:text-emerald-400"
                    }`}
                >
                    {isMine ? "-" : "+"}
                    {symbol}
                    {amount.toFixed(2)}
                </span>
                {canReturn && reversal && !reversal.expired && (
                    <button
                        onClick={onReturn}
                        disabled={isReturning}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground/80 transition-colors hover:bg-accent disabled:opacity-50"
                    >
                        {t("transfer.returnAction")}
                    </button>
                )}
            </div>
        </div>
    );
}
