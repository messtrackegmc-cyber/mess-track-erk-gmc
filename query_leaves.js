import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// simple .env parsing
const env = fs.readFileSync('.env', 'utf-8').split('\n').reduce((acc, line) => {
    const parts = line.split('=');
    if (parts.length >= 2) acc[parts[0]] = parts.slice(1).join('=');
    return acc;
}, {});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Fetching a leave...");
    const { data: leaves } = await supabase.from('leaves').select('*').limit(1);
    console.log(leaves);
    const l = leaves[0];
    
    console.log("Upserting with onConflict...");
    const { error: err1 } = await supabase.from('leaves').upsert([{
        student_id: l.student_id,
        mess_number: l.mess_number,
        leave_date: l.leave_date,
        hostel_id: l.hostel_id,
        is_admin_granted: true,
        status: 'Approved'
    }], { onConflict: 'mess_number, leave_date' });
    console.log("err1:", err1?.message);
    
    // just to be thorough, check other combinations
    const { error: err2 } = await supabase.from('leaves').upsert([{
        student_id: l.student_id,
        mess_number: l.mess_number,
        leave_date: l.leave_date,
        hostel_id: l.hostel_id,
        is_admin_granted: true,
        status: 'Approved'
    }]);
    console.log("err2:", err2?.message);
}
check();
