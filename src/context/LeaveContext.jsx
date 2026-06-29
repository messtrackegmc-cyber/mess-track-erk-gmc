import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const LeaveContext = createContext(null);

export function LeaveProvider({ children }) {
    const [leaves, setLeaves] = useState({});
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        if (user?.hostelId) {
            fetchLeaves();

            // ONLY Admins get real-time updates for leaves
            if (user.role === 'admin') {
                const subscription = supabase
                    .channel('leaves-channel')
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'leaves',
                            filter: `hostel_id=eq.${user.hostelId}`
                        },
                        () => {
                            fetchLeaves();
                        }
                    )
                    .subscribe();

                return () => {
                    supabase.removeChannel(subscription);
                };
            }
        } else {
            setLeaves({});
            setLoading(false);
        }
    }, [user?.hostelId, user?.role]);

    const fetchLeaves = async () => {
        if (!user?.hostelId) return;
        setLoading(true);

        const PAGE_SIZE = 1000;
        let allData = [];
        let from = 0;
        let keepFetching = true;

        // Date bounds: 2 months ago to 2 months from now for students
        // Admins get a wider view (e.g., from Jan 1 of last year to Dec 31 of next year)
        const now = new Date();
        let pastDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        let futureDate = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate());

        if (user.role === 'admin') {
            pastDate = new Date(now.getFullYear() - 1, 0, 1);
            futureDate = new Date(now.getFullYear() + 1, 11, 31);
        }

        const pastStr = pastDate.toISOString().split('T')[0];
        const futureStr = futureDate.toISOString().split('T')[0];

        while (keepFetching) {
            let query = supabase
                .from('leaves')
                .select('leave_date, mess_number, is_admin_granted')
                .eq('status', 'Approved')
                .eq('hostel_id', user.hostelId)
                .gte('leave_date', pastStr)
                .lte('leave_date', futureStr)
                .range(from, from + PAGE_SIZE - 1);

            // If STUDENT, only fetch OWN leaves
            if (user.role !== 'admin' && user.messNumber) {
                query = query.eq('mess_number', user.messNumber);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching leaves:', error);
                setLoading(false);
                return;
            }

            if (data && data.length > 0) {
                allData = allData.concat(data);
            }

            // If we got fewer rows than the page size, we've reached the end
            if (!data || data.length < PAGE_SIZE) {
                keepFetching = false;
            } else {
                from += PAGE_SIZE;
            }
        }

        // Transform records to map: { 'YYYY-MM-DD': [{ messNumber, isAdminGranted }] }
        const leavesMap = {};
        allData.forEach(record => {
            const d = record.leave_date;
            if (!leavesMap[d]) leavesMap[d] = [];

            // ENSURE UNIQUENESS AND PRIORITY
            const existingIdx = leavesMap[d].findIndex(l => l.messNumber === record.mess_number);
            if (existingIdx === -1) {
                leavesMap[d].push({
                    messNumber: record.mess_number,
                    isAdminGranted: record.is_admin_granted
                });
            } else if (record.is_admin_granted && !leavesMap[d][existingIdx].isAdminGranted) {
                // Overwrite student leave with admin leave priority
                leavesMap[d][existingIdx].isAdminGranted = true;
            }
        });
        setLeaves(leavesMap);
        setLoading(false);
    };

    const getLeavesByDate = (date) => {
        return leaves[date] || [];
    };

    const isStudentOnLeave = (messNumber, date) => {
        const shapeDate = date.includes('T') ? date.split('T')[0] : date;
        return leaves[shapeDate]?.some(l => l.messNumber === messNumber);
    };

    const addLeave = async (messNumber, date, studentId, isAdminGranted = false) => {
        if (!user?.hostelId) return { success: false, error: 'No hostel assigned' };
        const shapeDate = date.includes('T') ? date.split('T')[0] : date;

        // CHECK IF ALREADY EXISTS (Local Check)
        const existingLocal = leaves[shapeDate]?.find(l => l.messNumber === messNumber);
        if (existingLocal) {
            // If already exists, and we are trying to make it admin granted but it's not currently, update it
            if (isAdminGranted && !existingLocal.isAdminGranted) {
                // we will update db instead of insert
            } else {
                return { success: true, alreadyExists: true };
            }
        }

        // Optimistic update
        setLeaves(prev => {
            const current = prev[shapeDate] || [];
            const filtered = current.filter(l => l.messNumber !== messNumber);
            return {
                ...prev,
                [shapeDate]: [...filtered, { messNumber, isAdminGranted }]
            };
        });

        let sid = studentId;
        if (!sid) {
            const { data } = await supabase
                .from('students')
                .select('id')
                .eq('mess_number', messNumber)
                .eq('hostel_id', user.hostelId)
                .single();
            if (data) sid = data.id;
        }

        if (existingLocal) {
             const { error: updError } = await supabase.from('leaves')
                 .update({ is_admin_granted: true })
                 .eq('mess_number', messNumber)
                 .eq('leave_date', shapeDate)
                 .eq('hostel_id', user.hostelId);
             
             if (updError) {
                 console.error('Error updating leave override:', updError);
                 fetchLeaves();
                 return { success: false, error: updError.message };
             }
             return { success: true };
        }

        const { error } = await supabase.from('leaves').insert([{
            student_id: sid,
            mess_number: messNumber,
            leave_date: shapeDate,
            status: 'Approved',
            hostel_id: user.hostelId,
            is_admin_granted: isAdminGranted
        }]);

        if (error) {
            console.error('Error adding leave:', error);
            // Revert optimistic update
            fetchLeaves();
            return { success: false, error: error.message };
        }
        return { success: true };
    };

    const addBulkLeaves = async (studentsList, date, isAdminGranted = false) => {
        if (!user?.hostelId) return { success: false, error: 'No hostel assigned' };
        const shapeDate = date.includes('T') ? date.split('T')[0] : date;

        const newEntries = studentsList.map(s => ({
            student_id: s.id,
            mess_number: s.messNumber,
            leave_date: shapeDate,
            status: 'Approved',
            hostel_id: user.hostelId,
            is_admin_granted: isAdminGranted
        }));

        // Optimistic update
        setLeaves(prev => {
            const current = prev[shapeDate] || [];
            // Remove existing to replace
            const updated = current.filter(l => !studentsList.some(s => s.messNumber === l.messNumber));
            newEntries.forEach(entry => {
                updated.push({ messNumber: entry.mess_number, isAdminGranted });
            });
            return { ...prev, [shapeDate]: updated };
        });
        // Debugging logs requested by user
        console.log(`[LeaveContext: Backend Call] IDs received (studentsList.length):`, studentsList.length);
        console.log(`[LeaveContext: Backend Call] Request Payload (newEntries length):`, newEntries.length);
        
        // BATCHING LOGIC
        const BATCH_SIZE = 100;
        let finalData = [];
        let hasError = false;
        let errorMessage = '';

        for (let i = 0; i < newEntries.length; i += BATCH_SIZE) {
            const batch = newEntries.slice(i, i + BATCH_SIZE);
            const messNumbers = batch.map(b => b.mess_number);

            // Cleanup existing entries for this batch to avoid constraints/duplicates
            await supabase.from('leaves').delete()
                .eq('leave_date', shapeDate)
                .in('mess_number', messNumbers)
                .eq('hostel_id', user.hostelId);

            const { data, error } = await supabase.from('leaves').insert(batch).select();
            
            if (error) {
                hasError = true;
                errorMessage = error.message;
                break;
            }
            if (data) finalData = finalData.concat(data);
        }

        console.log(`[LeaveContext: Response] Error:`, hasError ? errorMessage : null);
        console.log(`[LeaveContext: Response] data.length (Rows actually updated):`, finalData.length);

        if (hasError) {
            console.error('Error adding bulk leaves:', errorMessage);
            fetchLeaves(); // Sync back
            return { success: false, error: errorMessage };
        }
        return { success: true };
    };

    const removeLeave = async (messNumber, date) => {
        if (!user?.hostelId) return { success: false, error: 'No hostel assigned' };
        const shapeDate = date.includes('T') ? date.split('T')[0] : date;

        setLeaves(prev => {
            const current = prev[shapeDate] || [];
            return { ...prev, [shapeDate]: current.filter(l => l.messNumber !== messNumber) };
        });

        const { error } = await supabase
            .from('leaves')
            .delete()
            .eq('mess_number', messNumber)
            .eq('leave_date', shapeDate)
            .eq('hostel_id', user.hostelId);

        if (error) {
            console.error('Error removing leave:', error);
            fetchLeaves();
            return { success: false, error: error.message };
        }

        return { success: true };
    };

    const removeBulkLeaves = async (date) => {
        if (!user?.hostelId) return { success: false, error: 'No hostel assigned' };
        const shapeDate = date.includes('T') ? date.split('T')[0] : date;

        setLeaves(prev => {
            const { [shapeDate]: _, ...rest } = prev;
            return rest;
        });

        const { error } = await supabase
            .from('leaves')
            .delete()
            .eq('leave_date', shapeDate)
            .eq('hostel_id', user.hostelId);

        if (error) {
            console.error('Error removing bulk leaves:', error);
            fetchLeaves();
            return { success: false, error: error.message };
        }
        return { success: true };
    };

    return (
        <LeaveContext.Provider value={{ leaves, loading, getLeavesByDate, addLeave, addBulkLeaves, removeLeave, removeBulkLeaves, isStudentOnLeave, refreshLeaves: fetchLeaves }}>
            {children}
        </LeaveContext.Provider>
    );
}

export function useLeaves() {
    const ctx = useContext(LeaveContext);
    if (!ctx) throw new Error('useLeaves must be used within a LeaveProvider');
    return ctx;
}
