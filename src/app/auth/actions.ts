"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Server Action to securely sign the user out.
 * Clears HTTP-only cookies on the server side and redirects to the login screen.
 */
export async function signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
}
