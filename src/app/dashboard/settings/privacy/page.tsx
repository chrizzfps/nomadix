"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    UsersThree,
    At,
    Copy,
    Check,
    ArrowsClockwise,
    Vault as VaultIcon,
    ShieldCheck,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
import {
    normalizeUsername,
    usernameCooldownDaysRemaining,
    validateUsername,
} from "@/lib/social";
import type { FriendSummary, Vault, VaultTransferPolicy } from "@/types";

interface IdentityState {
    username: string | null;
    friendCode: string | null;
    usernameChangedAt: string | null;
    discoverable: boolean;
}

export default function PrivacyPage() {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);

    const [isLoading, setIsLoading] = useState(true);
    const [identity, setIdentity] = useState<IdentityState | null>(null);
    const [usernameInput, setUsernameInput] = useState("");
    const [isSavingUsername, setIsSavingUsername] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isTogglingDiscoverable, setIsTogglingDiscoverable] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);
    const [vaults, setVaults] = useState<Vault[]>([]);
    const [allowlists, setAllowlists] = useState<Record<string, string[]>>({});
    const [friends, setFriends] = useState<FriendSummary[]>([]);

    useEffect(() => {
        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const [
                { data, error },
                { data: vaultRows, error: vaultsError },
                { data: friendRows },
            ] = await Promise.all([
                supabase
                    .from("users_profile")
                    .select("username, friend_code, username_changed_at, discoverable")
                    .eq("id", user.id)
                    .single(),
                supabase.from("vaults").select("*").eq("user_id", user.id).order("name"),
                supabase.rpc("nomadix_list_friends"),
            ]);

            if (error) {
                addToast(error.message, "error");
                setIsLoading(false);
                return;
            }
            setIdentity({
                username: data.username,
                friendCode: data.friend_code,
                usernameChangedAt: data.username_changed_at,
                discoverable: data.discoverable,
            });
            setUsernameInput(data.username ?? "");
            setFriends(((friendRows as FriendSummary[]) || []).filter((f) => f.status === "accepted"));

            const myVaults = (vaultRows as Vault[]) || [];
            setVaults(myVaults);
            if (vaultsError) addToast(vaultsError.message, "error");

            const allowlistVaultIds = myVaults
                .filter((v) => v.accepts_transfers_from === "allowlist")
                .map((v) => v.id);
            if (allowlistVaultIds.length > 0) {
                const { data: allowRows } = await supabase
                    .from("vault_transfer_allowlist")
                    .select("vault_id, friend_user_id")
                    .in("vault_id", allowlistVaultIds);
                const map: Record<string, string[]> = {};
                (allowRows || []).forEach((r) => {
                    (map[r.vault_id] ||= []).push(r.friend_user_id);
                });
                setAllowlists(map);
            }

            setIsLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateVaultLocal = (vaultId: string, patch: Partial<Vault>) => {
        setVaults((prev) => prev.map((v) => (v.id === vaultId ? { ...v, ...patch } : v)));
    };

    const savePolicy = async (vaultId: string, mode: VaultTransferPolicy, friendIds: string[]) => {
        const { error } = await supabase.rpc("nomadix_set_vault_transfer_policy", {
            p_vault_id: vaultId,
            p_mode: mode,
            p_friend_ids: friendIds,
        });
        if (error) {
            addToast(error.message, "error");
            return;
        }
        setAllowlists((prev) => ({ ...prev, [vaultId]: friendIds }));
        addToast(t("socialPrivacy.policySaved"));
    };

    const saveNote = async (vaultId: string, note: string) => {
        const { error } = await supabase
            .from("vaults")
            .update({ transfer_note: note.trim() || null })
            .eq("id", vaultId);
        if (error) addToast(error.message, "error");
    };

    const cooldownDays = identity
        ? usernameCooldownDaysRemaining(identity.usernameChangedAt)
        : 0;
    const normalizedInput = normalizeUsername(usernameInput);
    const validationError = usernameInput.trim() ? validateUsername(usernameInput) : null;
    const unchanged = identity?.username === normalizedInput;

    const saveUsername = async () => {
        if (validationError || unchanged) return;
        setIsSavingUsername(true);
        const { data, error } = await supabase.rpc("nomadix_set_username", {
            p_username: normalizedInput,
        });
        setIsSavingUsername(false);
        if (error) {
            const message = /already taken/i.test(error.message)
                ? t("socialPrivacy.usernameTaken")
                : error.message;
            addToast(message, "error");
            return;
        }
        setIdentity((prev) =>
            prev ? { ...prev, username: data as string, usernameChangedAt: new Date().toISOString() } : prev
        );
        addToast(t("socialPrivacy.usernameSaved"));
    };

    const regenerateCode = async () => {
        setIsRegenerating(true);
        const { data, error } = await supabase.rpc("nomadix_regenerate_friend_code");
        setIsRegenerating(false);
        if (error) {
            addToast(error.message, "error");
            return;
        }
        setIdentity((prev) => (prev ? { ...prev, friendCode: data as string } : prev));
        addToast(t("socialPrivacy.friendCodeRegenerated"));
    };

    const copyFriendCode = async () => {
        if (!identity?.friendCode) return;
        try {
            await navigator.clipboard.writeText(identity.friendCode);
            setCodeCopied(true);
            addToast(t("socialPrivacy.friendCodeCopied"));
            setTimeout(() => setCodeCopied(false), 2000);
        } catch {
            // clipboard permission denied — nothing to recover, stay silent
        }
    };

    const toggleDiscoverable = async () => {
        if (!identity) return;
        const next = !identity.discoverable;
        setIsTogglingDiscoverable(true);
        setIdentity({ ...identity, discoverable: next });
        const {
            data: { user },
        } = await supabase.auth.getUser();
        const { error } = await supabase
            .from("users_profile")
            .update({ discoverable: next })
            .eq("id", user!.id);
        setIsTogglingDiscoverable(false);
        if (error) {
            setIdentity({ ...identity, discoverable: !next });
            addToast(error.message, "error");
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-24 animate-pulse rounded-2xl bg-accent" />
                <div className="h-40 animate-pulse rounded-2xl bg-accent" />
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                    <UsersThree size={20} className="text-foreground/70" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground">{t("socialPrivacy.title")}</h2>
                    <p className="text-xs text-muted-foreground">{t("socialPrivacy.subtitle")}</p>
                </div>
            </div>

            {/* Identity */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                    {t("socialPrivacy.identitySection")}
                </h3>
                <div className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
                    {/* Username */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                            {t("socialPrivacy.usernameLabel")}
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <At
                                    size={16}
                                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                                />
                                <input
                                    type="text"
                                    placeholder={t("socialPrivacy.usernamePlaceholder")}
                                    value={usernameInput}
                                    disabled={cooldownDays > 0}
                                    onChange={(e) => setUsernameInput(e.target.value)}
                                    className="w-full rounded-xl border border-border bg-accent py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors disabled:opacity-60"
                                />
                            </div>
                            <button
                                onClick={saveUsername}
                                disabled={isSavingUsername || !!validationError || unchanged || cooldownDays > 0}
                                className="shrink-0 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 active:scale-[0.98]"
                            >
                                {t("socialPrivacy.usernameSave")}
                            </button>
                        </div>
                        {cooldownDays > 0 ? (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                {t("socialPrivacy.usernameCooldown", { days: cooldownDays })}
                            </p>
                        ) : validationError ? (
                            <p className="text-xs text-destructive">{validationError}</p>
                        ) : (
                            <p className="text-xs text-muted-foreground">{t("socialPrivacy.usernameHint")}</p>
                        )}
                    </div>

                    {/* Friend code */}
                    <div className="space-y-2 border-t border-border pt-5">
                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                            {t("socialPrivacy.friendCodeLabel")}
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-xl border border-border bg-accent px-4 py-3 font-mono text-sm font-semibold text-foreground">
                                {identity?.friendCode ?? "—"}
                            </span>
                            <button
                                onClick={copyFriendCode}
                                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground/80 transition-colors hover:bg-accent"
                            >
                                {codeCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                {t(codeCopied ? "socialPrivacy.friendCodeCopied" : "socialPrivacy.friendCodeCopy")}
                            </button>
                            <button
                                onClick={regenerateCode}
                                disabled={isRegenerating}
                                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground/80 transition-colors hover:bg-accent disabled:opacity-50"
                            >
                                <ArrowsClockwise size={14} className={isRegenerating ? "animate-spin" : ""} />
                                {t("socialPrivacy.friendCodeRegenerate")}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">{t("socialPrivacy.friendCodeHint")}</p>
                    </div>

                    {/* Discoverable */}
                    <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
                        <div>
                            <p className="text-sm font-medium text-foreground">
                                {t("socialPrivacy.discoverableLabel")}
                            </p>
                            <p className="text-xs text-muted-foreground">{t("socialPrivacy.discoverableDesc")}</p>
                        </div>
                        <label className="relative shrink-0 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={identity?.discoverable ?? true}
                                disabled={isTogglingDiscoverable}
                                onChange={toggleDiscoverable}
                                className="peer sr-only"
                            />
                            <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors" />
                            <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4" />
                        </label>
                    </div>
                </div>
            </div>

            {/* Vault transfer privacy */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                    {t("socialPrivacy.vaultsSection")}
                </h3>

                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3">
                    <ShieldCheck size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        {t("socialPrivacy.balanceNeverShown")}
                    </p>
                </div>

                <div className="space-y-3">
                    {vaults.map((vault) => (
                        <VaultPrivacyCard
                            key={vault.id}
                            vault={vault}
                            friends={friends}
                            selectedFriendIds={allowlists[vault.id] || []}
                            onSave={(mode, friendIds) => savePolicy(vault.id, mode, friendIds)}
                            onNoteChange={(note) => updateVaultLocal(vault.id, { transfer_note: note })}
                            onNoteSave={(note) => saveNote(vault.id, note)}
                            t={t}
                        />
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

function VaultPrivacyCard({
    vault,
    friends,
    selectedFriendIds,
    onSave,
    onNoteChange,
    onNoteSave,
    t,
}: {
    vault: Vault;
    friends: FriendSummary[];
    selectedFriendIds: string[];
    onSave: (mode: VaultTransferPolicy, friendIds: string[]) => void;
    onNoteChange: (note: string) => void;
    onNoteSave: (note: string) => void;
    t: (key: string, vars?: Record<string, string | number>) => string;
}) {
    const [mode, setMode] = useState<VaultTransferPolicy>(vault.accepts_transfers_from);
    const [selected, setSelected] = useState<string[]>(selectedFriendIds);
    const [isSaving, setIsSaving] = useState(false);
    const dirty = mode !== vault.accepts_transfers_from || (mode === "allowlist" &&
        JSON.stringify([...selected].sort()) !== JSON.stringify([...selectedFriendIds].sort()));

    const toggleFriend = (id: string) => {
        setSelected((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(mode, selected);
        setIsSaving(false);
    };

    const policies: { value: VaultTransferPolicy; labelKey: string; descKey: string }[] = [
        { value: "nobody", labelKey: "socialPrivacy.vaultPolicyNobody", descKey: "socialPrivacy.vaultPolicyNobodyDesc" },
        { value: "friends", labelKey: "socialPrivacy.vaultPolicyFriends", descKey: "socialPrivacy.vaultPolicyFriendsDesc" },
        { value: "allowlist", labelKey: "socialPrivacy.vaultPolicyAllowlist", descKey: "socialPrivacy.vaultPolicyAllowlistDesc" },
    ];

    return (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground/70">
                    <VaultIcon size={18} />
                </div>
                <p className="text-sm font-semibold text-foreground">{vault.name}</p>
            </div>

            <div className="space-y-2">
                {policies.map((p) => (
                    <label
                        key={p.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                            mode === p.value ? "border-primary bg-accent/60" : "border-border hover:bg-accent/40"
                        }`}
                    >
                        <input
                            type="radio"
                            name={`policy-${vault.id}`}
                            checked={mode === p.value}
                            onChange={() => setMode(p.value)}
                            className="mt-0.5"
                        />
                        <div>
                            <p className="text-sm font-medium text-foreground">{t(p.labelKey)}</p>
                            <p className="text-xs text-muted-foreground">{t(p.descKey)}</p>
                        </div>
                    </label>
                ))}
            </div>

            {mode === "allowlist" && (
                <div className="space-y-2 border-t border-border pt-4">
                    <p className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                        {t("socialPrivacy.selectFriends")}
                    </p>
                    {friends.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t("socialPrivacy.noFriendsToSelect")}</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {friends.map((f) => (
                                <button
                                    key={f.friend_id}
                                    type="button"
                                    onClick={() => toggleFriend(f.friend_id)}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                                        selected.includes(f.friend_id)
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-border bg-card text-muted-foreground hover:border-ring"
                                    }`}
                                >
                                    {f.username ? `@${f.username}` : f.full_name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="border-t border-border pt-4">
                <input
                    type="text"
                    placeholder={t("socialPrivacy.notePlaceholder")}
                    defaultValue={vault.transfer_note ?? ""}
                    onChange={(e) => onNoteChange(e.target.value)}
                    onBlur={(e) => onNoteSave(e.target.value)}
                    className="w-full rounded-xl border border-border bg-accent px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                />
            </div>

            {dirty && (
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 active:scale-[0.98]"
                >
                    {t("socialPrivacy.savePolicy")}
                </button>
            )}
        </div>
    );
}
