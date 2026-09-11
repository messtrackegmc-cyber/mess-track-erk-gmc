import { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Users, AlertCircle, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudents } from '../context/StudentContext';
import { supabase } from '../lib/supabaseClient';

export default function AdminDashboard({ showTomorrow = false }) {
    const { user } = useAuth();
    const { students, loading: studentsLoading } = useStudents();
    const [dayLeaves, setDayLeaves] = useState([]);
    const [dayLeavesLoading, setDayLeavesLoading] = useState(true);

    // Calculate target date (Today or Tomorrow)
    const targetDate = new Date();
    if (showTomorrow) {
        targetDate.setDate(targetDate.getDate() + 1);
    }
    const dateKey = targetDate.toLocaleDateString('en-CA');

    useEffect(() => {
        if (!user?.hostelId) {
            setDayLeaves([]);
            setDayLeavesLoading(false);
            return;
        }

        let isCancelled = false;

        const fetchDayLeaves = async () => {
            setDayLeavesLoading(true);
            try {
                const { data, error } = await supabase
                    .from('leaves')
                    .select('mess_number, is_admin_granted')
                    .eq('hostel_id', user.hostelId)
                    .eq('leave_date', dateKey)
                    .eq('status', 'Approved');

                if (error) throw error;
                if (!isCancelled) {
                    setDayLeaves(data || []);
                }
            } catch (err) {
                console.error('Error fetching dashboard leaves for date:', dateKey, err);
            } finally {
                if (!isCancelled) {
                    setDayLeavesLoading(false);
                }
            }
        };

        fetchDayLeaves();

        // Real-time listener for leave changes in this hostel
        const subscription = supabase
            .channel(`admin-dashboard-leaves-${dateKey}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'leaves',
                    filter: `hostel_id=eq.${user.hostelId}`
                },
                () => {
                    fetchDayLeaves();
                }
            )
            .subscribe();

        return () => {
            isCancelled = true;
            supabase.removeChannel(subscription);
        };
    }, [user?.hostelId, dateKey]);

    const isLoading = studentsLoading || dayLeavesLoading;

    const totalStudents = students.length;
    const totalMales = students.filter(s => s.messNumber?.toUpperCase().startsWith('M')).length;
    const totalFemales = students.filter(s => s.messNumber?.toUpperCase().startsWith('F')).length;

    // Deduplicate by mess_number to guarantee accuracy
    const uniqueDayLeaves = [];
    const seenMess = new Set();
    dayLeaves.forEach(l => {
        const m = l.mess_number || l.messNumber;
        if (m && !seenMess.has(m)) {
            seenMess.add(m);
            uniqueDayLeaves.push(l);
        }
    });

    const leavesCount = uniqueDayLeaves.length;
    const leavesMale = uniqueDayLeaves.filter(l => (l.mess_number || l.messNumber)?.toUpperCase().startsWith('M')).length;
    const leavesFemale = uniqueDayLeaves.filter(l => (l.mess_number || l.messNumber)?.toUpperCase().startsWith('F')).length;

    const activeCount = totalStudents - leavesCount;
    const activeMale = totalMales - leavesMale;
    const activeFemale = totalFemales - leavesFemale;

    const attendancePercentage = totalStudents > 0 ? Math.round((activeCount / totalStudents) * 100) : 0;

    const stats = [
        {
            label: 'Total Students',
            value: totalStudents,
            desc: 'Registered students',
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            males: totalMales,
            females: totalFemales,
        },
        {
            label: showTomorrow ? 'Active Tomorrow' : 'Active Today',
            value: activeCount,
            desc: `${attendancePercentage}% attendance`,
            icon: UtensilsCrossed,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            males: activeMale,
            females: activeFemale,
        },
        {
            label: showTomorrow ? 'Leave Tomorrow' : 'Leave Today',
            value: leavesCount,
            desc: 'Students on leave',
            icon: AlertCircle,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            males: leavesMale,
            females: leavesFemale,
        },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                    {showTomorrow ? 'Tomorrow Overview' : 'Dashboard Overview'}
                </h1>
                <p className="text-gray-500 mt-2">
                    {showTomorrow 
                        ? `Here's tomorrow's summary (${targetDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}).`
                        : "Welcome back, Admin. Here's today's summary."
                    }
                </p>
            </div>

            {/* Stats Grid - Simplified to 3 Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat) => (
                    <Card key={stat.label} className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                                {isLoading ? (
                                    <Skeleton className="h-9 w-24 mt-1" />
                                ) : (
                                    <h3 className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</h3>
                                )}
                                {isLoading ? (
                                    <Skeleton className="h-4 w-32 mt-1" />
                                ) : (
                                    <p className="text-xs text-gray-400 mt-1">{stat.desc}</p>
                                )}

                                {/* Gender breakdown */}
                                {isLoading ? (
                                    <Skeleton className="h-5 w-28 mt-3" />
                                ) : (
                                    <div className="flex items-center gap-2 mt-3">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
                                            <span>♂</span>
                                            <span>{stat.males}M</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-pink-50 text-pink-600 text-sm font-semibold">
                                            <span>♀</span>
                                            <span>{stat.females}F</span>
                                        </span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
