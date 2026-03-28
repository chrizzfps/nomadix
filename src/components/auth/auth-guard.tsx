"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const supabase = createClient();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let mounted = true;
        (async () => {
            const { data } = await supabase.auth.getSession();
            if (!mounted) return;
            if (!data.session) {
                router.replace("/login");
                return;
            }
            setReady(true);
        })();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) router.replace("/login");
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [router, supabase]);

    if (!ready) return null;
    return <>{children}</>;
}

