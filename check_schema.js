import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: leaves, error } = await supabase.from('leaves').select('*').limit(5);
    console.log("Leaves sample:", leaves);
    
    // Try to insert duplicates to see constraint error
    if (leaves && leaves.length > 0) {
        const { error: insErr } = await supabase.from('leaves').insert([
            {
               student_id: leaves[0].student_id,
               mess_number: leaves[0].mess_number,
               leave_date: leaves[0].leave_date,
               hostel_id: leaves[0].hostel_id,
               status: 'Approved'
            }
        ]);
        console.log("Insert duplicate error:", insErr);
    }
}
check();
