import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wymrknfpnspmvxgfybpi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bXJrbmZwbnNwbXZ4Z2Z5YnBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTQwNjEsImV4cCI6MjA4NjQ5MDA2MX0.nZuxUxJNw2-miG4f6ahIUSrINEyN8Qh1vHjQf3x1zQs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .eq('is_admin_granted', true)
        .eq('leave_date', '2026-04-01')
        .order('created_at', { ascending: false });
    
    if (error) console.error(error);
    else console.log(data);
}
run();
