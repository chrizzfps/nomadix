"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
    Plus,
    Airplane,
    MapTrifold,
    CalendarBlank,
    CurrencyEur,
} from "@phosphor-icons/react";
import { TripCard } from "@/components/travel/trip-card";
import { CreateTripModal } from "@/components/travel/create-trip-modal";
import { createClient } from "@/lib/supabase/client";

interface Trip {
    id: string;
    destination_name: string;
    start_date: string | null;
    end_date: string | null;
    total_budget: number | null;
    currency: string;
    created_at: string;
}

export default function TravelPage() {
    const supabase = createClient();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const loadTrips = useCallback(async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from("trips")
            .select("*")
            .eq("user_id", user.id)
            .order("start_date", { ascending: true, nullsFirst: false });

        setTrips(data || []);
        setIsLoading(false);
    }, [supabase]);

    useEffect(() => {
        loadTrips();
    }, [loadTrips]);

    const now = new Date();
    const upcomingTrips = trips.filter(
        (t) => t.start_date && new Date(t.start_date) > now
    );
    const totalBudget = trips.reduce(
        (sum, t) => sum + (t.total_budget || 0),
        0
    );

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                        Travel
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        Plan and track your adventures.
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98]"
                >
                    <Plus size={16} weight="bold" />
                    New Trip
                </button>
            </div>

            {/* Stats Row */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mt-8 grid grid-cols-3 gap-4"
            >
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                        <MapTrifold size={18} className="text-zinc-600" />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900">
                        {trips.length}
                    </p>
                    <p className="text-[10px] font-medium tracking-wide uppercase text-zinc-400">
                        Total Trips
                    </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                        <CalendarBlank size={18} className="text-zinc-600" />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900">
                        {upcomingTrips.length}
                    </p>
                    <p className="text-[10px] font-medium tracking-wide uppercase text-zinc-400">
                        Upcoming
                    </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                        <CurrencyEur size={18} className="text-zinc-600" />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900">
                        €{totalBudget.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-medium tracking-wide uppercase text-zinc-400">
                        Budget Allocated
                    </p>
                </div>
            </motion.div>

            {/* Trip Cards Grid */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
                {isLoading
                    ? [1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="h-44 animate-pulse rounded-2xl bg-zinc-100"
                        />
                    ))
                    : trips.map((trip) => (
                        <TripCard
                            key={trip.id}
                            id={trip.id}
                            destinationName={trip.destination_name}
                            startDate={trip.start_date}
                            endDate={trip.end_date}
                            totalBudget={trip.total_budget}
                            currency={trip.currency}
                        />
                    ))}

                {/* Add Trip Placeholder */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setShowModal(true)}
                    className="flex h-44 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-500"
                >
                    <Airplane size={24} />
                    <span className="text-xs font-semibold">Add Trip</span>
                </motion.button>
            </motion.div>

            {/* Modal */}
            <CreateTripModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onCreated={loadTrips}
            />
        </div>
    );
}
