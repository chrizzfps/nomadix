import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe("Temp DB Query", () => {
    it("queries transactions", async () => {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase
            .from("transactions")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(10);
            
        if (error) {
            console.error("ERROR:", error);
        } else {
            console.log("TRANSACTIONS IN DB:");
            data.forEach(tx => {
                console.log(`ID: ${tx.id} | Amount: ${tx.amount} | Currency: ${tx.original_currency} | Type: ${tx.type} | Desc: ${tx.description} | Rate: ${tx.exchange_rate_at_time} | Fee: ${tx.fee}`);
            });
        }
    });
});
