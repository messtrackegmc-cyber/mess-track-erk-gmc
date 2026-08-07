import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { UtensilsCrossed, Clock, Users, RefreshCw, Coffee, Sun, Moon } from 'lucide-react';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

export default function AdminMealFeed() {
    const { user } = useAuth();
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [studentMap, setStudentMap] = useState({});

    const fetchClaims = async (showToast = false) => {
        if (showToast) setIsRefreshing(true);
        try {
            const today = new Date().toLocaleDateString('en-CA');
            
            // 1. Fetch claims for today
            const { data: claimsData, error: claimsError } = await supabase
                .from('meal_claims')
                .select('*')
                .eq('hostel_id', user?.hostelId)
                .eq('claim_date', today)
                .order('claimed_at', { ascending: false });

            if (claimsError) throw claimsError;

            // 2. Fetch student list to map student names & mess numbers accurately
            const { data: studentsData } = await supabase
                .from('students')
                .select('id, name, mess_number')
                .eq('hostel_id', user?.hostelId);

            if (studentsData) {
                const map = {};
                studentsData.forEach(s => {
                    map[s.id] = s;
                });
                setStudentMap(map);
            }

            setClaims(claimsData || []);
            if (showToast) toast.success('Feed refreshed');
        } catch (err) {
            console.error('Error fetching claims:', err);
            if (showToast) toast.error('Failed to refresh feed');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (!user?.hostelId) return;
        fetchClaims();

        const subscription = supabase
            .channel('meal-claims-channel')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'meal_claims',
                filter: `hostel_id=eq.${user.hostelId}`
            }, () => {
                fetchClaims();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [user?.hostelId]);

    const todayDateStr = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    const breakfastCount = claims.filter(c => c.meal_type?.toLowerCase() === 'breakfast').length;
    const lunchCount = claims.filter(c => c.meal_type?.toLowerCase() === 'lunch').length;
    const dinnerCount = claims.filter(c => c.meal_type?.toLowerCase() === 'dinner').length;

    const formatTime = (isoString) => {
        return new Date(isoString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const getMealBadge = (mealType) => {
        const type = mealType?.toLowerCase();
        switch (type) {
            case 'breakfast':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none font-medium">Breakfast</Badge>;
            case 'lunch':
                return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none font-medium">Lunch</Badge>;
            case 'dinner':
                return <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-none font-medium">Dinner</Badge>;
            default:
                return <Badge>{mealType}</Badge>;
        }
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-10">
            <Toaster />

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Meal Check-in Feed</h1>
                    <p className="text-gray-500 text-base">{todayDateStr}</p>
                </div>
                <Button 
                    variant="outline" 
                    onClick={() => fetchClaims(true)}
                    disabled={isRefreshing || loading}
                    className="gap-2 shrink-0 bg-white"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Summary Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-white border-blue-100 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                            <Coffee className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Breakfast</p>
                            <h3 className="text-2xl font-bold text-gray-900">{loading ? '-' : breakfastCount}</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-amber-100 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                            <Sun className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Lunch</p>
                            <h3 className="text-2xl font-bold text-gray-900">{loading ? '-' : lunchCount}</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-indigo-100 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                            <Moon className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Dinner</p>
                            <h3 className="text-2xl font-bold text-gray-900">{loading ? '-' : dinnerCount}</h3>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Claims Table Card */}
            <Card className="border-gray-200 shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-6">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <UtensilsCrossed className="w-5 h-5 text-gray-400" />
                        Today's Claims
                    </CardTitle>
                </CardHeader>
                
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-6 space-y-4">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Skeleton key={i} className="h-12 w-full rounded-md" />
                            ))}
                        </div>
                    ) : claims.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <UtensilsCrossed className="w-8 h-8 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-1">No claims yet</h3>
                            <p className="text-gray-500 text-sm">No meal claims today yet. They will appear here in real-time.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 font-medium whitespace-nowrap">#</th>
                                    <th className="px-6 py-4 font-medium">Mess Number</th>
                                    <th className="px-6 py-4 font-medium">Student Name</th>
                                    <th className="px-6 py-4 font-medium">Meal</th>
                                    <th className="px-6 py-4 font-medium">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {claims.map((claim, index) => {
                                    const student = studentMap[claim.student_id] || {};
                                    const messNumber = claim.mess_number || student.mess_number || claim.student_mess_no || '-';
                                    const studentName = student.name || claim.student_name || 'Unknown';
                                    return (
                                        <tr key={claim.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 text-gray-400">{claims.length - index}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{messNumber}</td>
                                            <td className="px-6 py-4 text-gray-700">{studentName}</td>
                                            <td className="px-6 py-4">{getMealBadge(claim.meal_type)}</td>
                                            <td className="px-6 py-4 text-gray-500 flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                {formatTime(claim.claimed_at)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>
        </div>
    );
}
