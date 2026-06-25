const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf-8').split('\n').reduce((acc, line) => {
    const parts = line.split('=');
    if (parts.length >= 2) acc[parts[0]] = parts.slice(1).join('=');
    return acc;
}, {});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const dates = ['2026-04-04'];
    const { data: before } = await supabase.from('leaves').select('*').in('leave_date', dates).limit(5);
    console.log("Before manual script delete:");
    console.log(before);

    // Let's grab the hostel_id of Mess 40 just to be sure
    const m40 = before.find(x => x.mess_number === '40');
    const hostelId = m40 ? m40.hostel_id : before[0].hostel_id;

    console.log("Executing exact delete from ManageLeaves:");
    const { data: delData, error: delErr } = await supabase.from('leaves')
        .delete()
        .in('leave_date', dates)
        .eq('hostel_id', hostelId).select();

    console.log("Delete error:", delErr);
    console.log("Deleted rows:", delData?.length);
    
    // Check if mess 40 is actually gone
    const { data: after } = await supabase.from('leaves').select('*').in('leave_date', dates).limit(5);
    console.log("After:", after.length);
}
check();
