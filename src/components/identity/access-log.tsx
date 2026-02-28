"use client";

import {
    Eye,
    DownloadSimple,
    ShareNetwork,
    CloudArrowUp,
} from "@phosphor-icons/react";
import type { AccessLogEntry } from "@/types";

interface AccessLogProps {
    entries: AccessLogEntry[];
}

const actionIcons: Record<AccessLogEntry["action"], React.ElementType> = {
    viewed: Eye,
    downloaded: DownloadSimple,
    shared: ShareNetwork,
    uploaded: CloudArrowUp,
};

const actionLabels: Record<AccessLogEntry["action"], string> = {
    viewed: "Viewed",
    downloaded: "Downloaded",
    shared: "Shared",
    uploaded: "Uploaded",
};

export function AccessLog({ entries }: AccessLogProps) {
    return (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {/* Table Header */}
            <div className="grid grid-cols-[100px_1fr_1fr_1fr] gap-4 border-b border-zinc-100 px-5 py-3 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                <span>Date</span>
                <span>Action</span>
                <span>Document</span>
                <span>Device</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-zinc-50">
                {entries.map((entry) => {
                    const IconCmp = actionIcons[entry.action];
                    return (
                        <div
                            key={entry.id}
                            className="grid grid-cols-[100px_1fr_1fr_1fr] items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-zinc-50"
                        >
                            <span className="text-xs text-zinc-400">
                                {entry.timestamp}
                            </span>
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                                    <IconCmp
                                        size={14}
                                        className="text-zinc-500"
                                    />
                                </div>
                                <span className="font-medium text-zinc-900">
                                    {actionLabels[entry.action]}
                                </span>
                            </div>
                            <span className="truncate text-zinc-500">
                                {entry.document_title}
                            </span>
                            <span className="text-xs text-zinc-400">
                                {entry.device}
                            </span>
                        </div>
                    );
                })}

                {entries.length === 0 && (
                    <div className="px-5 py-8 text-center text-sm text-zinc-400">
                        No activity recorded yet.
                    </div>
                )}
            </div>
        </div>
    );
}
