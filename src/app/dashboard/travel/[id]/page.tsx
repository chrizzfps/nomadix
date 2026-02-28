"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    MapPin,
    CalendarBlank,
    Plus,
    Trash,
    CurrencyEur,
    CurrencyDollar,
    ListNumbers,
} from "@phosphor-icons/react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Trip {
    id: string;
    destination_name: string;
    start_date: string | null;
    end_date: string | null;
    total_budget: number | null;
    currency: string;
}

interface ItineraryItem {
    id: string;
    day_number: number;
    title: string | null;
    description: string | null;
    estimated_cost: number | null;
}

export default function TripDetailPage() {
    const params = useParams();
    const router = useRouter();
    const supabase = createClient();
    const tripId = params.id as string;

    const [trip, setTrip] = useState<Trip | null>(null);
    const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Add day form
    const [showAddDay, setShowAddDay] = useState(false);
    const [newDayTitle, setNewDayTitle] = useState("");
    const [newDayDesc, setNewDayDesc] = useState("");
    const [newDayCost, setNewDayCost] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    const loadData = useCallback(async () => {
        const { data: tripData } = await supabase
            .from("trips")
            .select("*")
            .eq("id", tripId)
            .single();

        if (!tripData) {
            router.push("/dashboard/travel");
            return;
        }
        setTrip(tripData);

        const { data: itineraryData } = await supabase
            .from("trip_itineraries")
            .select("*")
            .eq("trip_id", tripId)
            .order("day_number", { ascending: true });

        setItinerary(itineraryData || []);
        setIsLoading(false);
    }, [supabase, tripId, router]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleAddDay = async () => {
        if (!newDayTitle.trim()) return;
        setIsAdding(true);

        const nextDay =
            itinerary.length > 0
                ? Math.max(...itinerary.map((i) => i.day_number)) + 1
                : 1;

        await supabase.from("trip_itineraries").insert({
            trip_id: tripId,
            day_number: nextDay,
            title: newDayTitle.trim(),
            description: newDayDesc.trim() || null,
            estimated_cost: newDayCost ? parseFloat(newDayCost) : null,
        });

        setNewDayTitle("");
        setNewDayDesc("");
        setNewDayCost("");
        setShowAddDay(false);
        setIsAdding(false);
        loadData();
    };

    const handleDeleteDay = async (id: string) => {
        await supabase.from("trip_itineraries").delete().eq("id", id);
        loadData();
    };

    if (isLoading) {
        return (
            <div className="p-6 lg:p-8 space-y-4">
                <div className="h-8 w-32 animate-pulse rounded-lg bg-zinc-100" />
                <div className="h-48 animate-pulse rounded-2xl bg-zinc-100" />
                <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
            </div>
        );
    }

    if (!trip) return null;

    const symbol = trip.currency === "EUR" ? "€" : "$";
    const CurrencyIcon =
        trip.currency === "EUR" ? CurrencyEur : CurrencyDollar;
    const totalSpent = itinerary.reduce(
        (sum, i) => sum + (i.estimated_cost || 0),
        0
    );
    const budgetPercent =
        trip.total_budget && trip.total_budget > 0
            ? Math.min((totalSpent / trip.total_budget) * 100, 100)
            : 0;

    const formatDate = (d: string | null) => {
        if (!d) return "TBD";
        return new Date(d).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    return (
        <div className="p-6 lg:p-8">
            {/* Back */}
            <Link
                href="/dashboard/travel"
                className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-600"
            >
                <ArrowLeft size={14} />
                Back to Travel
            </Link>

            {/* Trip Header */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 p-6 text-white"
            >
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <MapPin size={12} weight="fill" />
                            Trip
                        </div>
                        <h1 className="mt-2 text-2xl font-bold tracking-tight">
                            {trip.destination_name}
                        </h1>
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-zinc-400">
                            <CalendarBlank size={14} />
                            {formatDate(trip.start_date)} —{" "}
                            {formatDate(trip.end_date)}
                        </div>
                    </div>
                </div>

                {/* Budget Progress */}
                {trip.total_budget && trip.total_budget > 0 && (
                    <div className="mt-6">
                        <div className="flex justify-between text-xs">
                            <span className="flex items-center gap-1 text-zinc-400">
                                <CurrencyIcon size={12} />
                                Budget
                            </span>
                            <span className="font-semibold text-zinc-300">
                                {symbol}
                                {totalSpent.toLocaleString()} / {symbol}
                                {trip.total_budget.toLocaleString()}
                            </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-700">
                            <div
                                className={`h-full rounded-full transition-all ${budgetPercent > 90
                                        ? "bg-red-400"
                                        : budgetPercent > 70
                                            ? "bg-amber-400"
                                            : "bg-white/60"
                                    }`}
                                style={{ width: `${budgetPercent}%` }}
                            />
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Itinerary */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-6"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ListNumbers
                            size={18}
                            className="text-zinc-600"
                        />
                        <h2 className="text-lg font-semibold text-zinc-900">
                            Itinerary
                        </h2>
                    </div>
                    <button
                        onClick={() => setShowAddDay(!showAddDay)}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-all hover:bg-zinc-50"
                    >
                        <Plus size={12} weight="bold" />
                        Add Day
                    </button>
                </div>

                {/* Add Day Form */}
                {showAddDay && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4"
                    >
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={newDayTitle}
                                onChange={(e) => setNewDayTitle(e.target.value)}
                                placeholder="Day title (e.g. Explore Old Town)"
                                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                            />
                            <input
                                type="text"
                                value={newDayDesc}
                                onChange={(e) => setNewDayDesc(e.target.value)}
                                placeholder="Description (optional)"
                                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={newDayCost}
                                    onChange={(e) =>
                                        setNewDayCost(e.target.value)
                                    }
                                    placeholder="Estimated cost"
                                    min="0"
                                    step="0.01"
                                    className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                />
                                <button
                                    onClick={handleAddDay}
                                    disabled={isAdding || !newDayTitle.trim()}
                                    className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 disabled:opacity-50"
                                >
                                    {isAdding ? "Adding..." : "Add"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Itinerary List */}
                <div className="mt-4 space-y-3">
                    {itinerary.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 py-12 text-zinc-400">
                            <CalendarBlank
                                size={32}
                                weight="thin"
                                className="text-zinc-300"
                            />
                            <p className="mt-2 text-sm font-medium">
                                No itinerary yet
                            </p>
                            <p className="text-xs text-zinc-300">
                                Add your first day to get started
                            </p>
                        </div>
                    ) : (
                        itinerary.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:bg-zinc-50"
                            >
                                {/* Day Number */}
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-sm font-bold text-white">
                                    {item.day_number}
                                </div>

                                {/* Content */}
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-zinc-900 text-sm">
                                        {item.title || `Day ${item.day_number}`}
                                    </p>
                                    {item.description && (
                                        <p className="mt-0.5 text-xs text-zinc-400">
                                            {item.description}
                                        </p>
                                    )}
                                </div>

                                {/* Cost + Delete */}
                                <div className="flex items-center gap-2 shrink-0">
                                    {item.estimated_cost != null &&
                                        item.estimated_cost > 0 && (
                                            <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                                                {symbol}
                                                {item.estimated_cost.toLocaleString()}
                                            </span>
                                        )}
                                    <button
                                        onClick={() =>
                                            handleDeleteDay(item.id)
                                        }
                                        className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-500"
                                    >
                                        <Trash size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </motion.div>
        </div>
    );
}
