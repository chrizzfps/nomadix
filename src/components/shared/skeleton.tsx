"use client";

export function SkeletonLine({ className = "" }: { className?: string }) {
    return (
        <div
            className={`h-4 animate-pulse rounded-lg bg-accent ${className}`}
        />
    );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
    return (
        <div
            className={`animate-pulse rounded-2xl bg-accent ${className}`}
        />
    );
}

export function SkeletonCircle({
    size = 40,
    className = "",
}: {
    size?: number;
    className?: string;
}) {
    return (
        <div
            className={`animate-pulse rounded-full bg-accent ${className}`}
            style={{ width: size, height: size }}
        />
    );
}
