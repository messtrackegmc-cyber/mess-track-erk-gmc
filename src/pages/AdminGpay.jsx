import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useStudents } from '../context/StudentContext';
import { useHostel } from '../context/HostelContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Calendar, IndianRupee, CheckCircle2, Circle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function AdminGpay() {
    const { user } = useAuth();
    const { students } = useStudents();
    const { messRate } = useHostel();

    // Month navigation
    const now = new Date();
    const [selectedDate, setSelectedDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
    const currentYear = selectedDate.getFullYear();
    const currentMonth = selectedDate.getMonth();
    const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();
    const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthName = selectedDate.toLocaleString('default', { month: 'long' });

    const handlePrevMonth = () => setSelectedDate(new Date(currentYear, currentMonth - 1, 1));
    const handleNextMonth = () => setSelectedDate(new Date(currentYear, currentMonth + 1, 1));

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Leaves for the month (same logic as AdminBills)
    const [rangeLeaves, setRangeLeaves] = useState({});
    const [loadingLeaves, setLoadingLeaves] = useState(false);

    // GPay payment records
    const [paymentMap, setPaymentMap] = useState({}); // key: mess_number -> { amount_paid, is_paid, id }
    const [togglingId, setTogglingId] = useState(null);

    // Fetch leaves
    useEffect(() => {
        if (!user?.hostelId) return;
        const fetchLeaves = async () => {
            setLoadingLeaves(true);
            const startStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
            const endStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

            const PAGE_SIZE = 1000;
            let allData = [];
            let from = 0;
            let keepFetching = true;

            while (keepFetching) {
                const { data, error } = await supabase
                    .from('leaves')
                    .select('leave_date, mess_number')
                    .eq('status', 'Approved')
                    .eq('hostel_id', user.hostelId)
                    .gte('leave_date', startStr)
                    .lte('leave_date', endStr)
                    .range(from, from + PAGE_SIZE - 1);

                if (error) { console.error(error); break; }
                if (data && data.length > 0) allData = allData.concat(data);
                if (!data || data.length < PAGE_SIZE) keepFetching = false;
                else from += PAGE_SIZE;
            }

            const leavesMap = {};
            allData.forEach(record => {
                if (!leavesMap[record.leave_date]) leavesMap[record.leave_date] = [];
                leavesMap[record.leave_date].push({ messNumber: record.mess_number });
            });
            setRangeLeaves(leavesMap);
            setLoadingLeaves(false);
        };
        fetchLeaves();
    }, [user?.hostelId, currentYear, currentMonth, daysInMonth]);

    // Fetch payment records for the month
    const fetchPayments = async () => {
        if (!user?.hostelId) return;
        const { data, error } = await supabase
            .from('gpay_payments')
            .select('mess_number, amount_paid, is_paid')
            .eq('hostel_id', user.hostelId)
            .eq('month', monthKey);

        if (error) { console.error(error); return; }

        const map = {};
        (data || []).forEach(row => {
            map[row.mess_number] = {
                amount_paid: row.amount_paid ?? 0,
                is_paid: row.is_paid ?? false,
            };
        });
        setPaymentMap(map);
    };

    useEffect(() => {
        fetchPayments();
    }, [user?.hostelId, monthKey]);

    // Build date range for leave counting
    const dateRange = [];
    for (let d = 1; d <= daysInMonth; d++) {
        dateRange.push(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }

    // Compute per-student data
    const studentRows = students.map(student => {
        let leaveCount = 0;
        dateRange.forEach(dateKey => {
            const leavesOnDay = rangeLeaves[dateKey] || [];
            if (leavesOnDay.some(l => l.messNumber === student.messNumber)) leaveCount++;
        });
        const billableDays = daysInMonth - leaveCount;
        const messBill = billableDays * messRate;
        const payment = paymentMap[student.messNumber] || { amount_paid: 0, is_paid: false };
        const amountPaid = payment.amount_paid;
        const balance = messBill - amountPaid;
        const isPaid = payment.is_paid;

        return { ...student, leaveCount, billableDays, messBill, amountPaid, balance, isPaid };
    });

    // Totals
    const totalBill = studentRows.reduce((s, r) => s + r.messBill, 0);
    const totalPaid = studentRows.reduce((s, r) => s + r.amountPaid, 0);
    const totalBalance = studentRows.reduce((s, r) => s + r.balance, 0);
    const paidCount = studentRows.filter(r => r.isPaid).length;

    // Toggle is_paid
    const handleTogglePaid = async (student) => {
        const current = paymentMap[student.messNumber] || { amount_paid: 0, is_paid: false };
        const newIsPaid = !current.is_paid;
        setTogglingId(student.messNumber);

        const { error } = await supabase
            .from('gpay_payments')
            .upsert({
                hostel_id: user.hostelId,
                mess_number: student.messNumber,
                month: monthKey,
                amount_paid: current.amount_paid,
                is_paid: newIsPaid,
            }, {
                onConflict: 'hostel_id,mess_number,month',
                ignoreDuplicates: false,
            });

        if (!error) {
            setPaymentMap(prev => ({
                ...prev,
                [student.messNumber]: { ...current, is_paid: newIsPaid },
            }));
        } else {
            console.error('Toggle error:', error);
        }
        setTogglingId(null);
    };

    const isLoading = loadingLeaves;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">GPay Payments</h1>
                    <p className="text-gray-500 mt-1">Track student payments and confirm settlements.</p>
                </div>
                {/* Month Navigator */}
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="font-semibold text-gray-900 min-w-[140px] text-center">
                        {monthName} {currentYear}
                    </div>
                    <Button variant="outline" size="icon" onClick={handleNextMonth} disabled={isCurrentMonth}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50/30">
                    <CardContent className="p-4">
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Total Bill</p>
                        <p className="text-2xl font-bold text-gray-900">₹{totalBill.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-emerald-50 to-green-50/30">
                    <CardContent className="p-4">
                        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Total Collected</p>
                        <p className="text-2xl font-bold text-gray-900">₹{totalPaid.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-red-50 to-rose-50/30">
                    <CardContent className="p-4">
                        <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">Outstanding</p>
                        <p className="text-2xl font-bold text-gray-900">₹{totalBalance.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50/30">
                    <CardContent className="p-4">
                        <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-1">Settled</p>
                        <p className="text-2xl font-bold text-gray-900">{paidCount} / {students.length}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card className="border-gray-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                    <CardTitle className="text-lg">Payment Tracker — {monthName} {currentYear}</CardTitle>
                    <CardDescription>Rate: ₹{messRate}/day · Click the toggle to mark a student as paid</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="px-5 py-4">Mess No</th>
                                        <th className="px-5 py-4">Student Name</th>
                                        <th className="px-5 py-4 text-right">Mess Bill (₹)</th>
                                        <th className="px-5 py-4 text-right">Amount Paid (₹)</th>
                                        <th className="px-5 py-4 text-right">Balance (₹)</th>
                                        <th className="px-5 py-4 text-center">Paid</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {studentRows.map((student) => (
                                        <tr
                                            key={student.id}
                                            className={`transition-all ${
                                                student.isPaid
                                                    ? 'bg-gray-50/70 opacity-60'
                                                    : 'hover:bg-gray-50/50'
                                            }`}
                                        >
                                            <td className={`px-5 py-4 font-medium text-gray-900 ${student.isPaid ? 'line-through text-gray-400' : ''}`}>
                                                {student.messNumber}
                                            </td>
                                            <td className={`px-5 py-4 text-gray-700 ${student.isPaid ? 'line-through text-gray-400' : ''}`}>
                                                {student.name}
                                            </td>
                                            <td className={`px-5 py-4 text-right font-medium text-gray-900 ${student.isPaid ? 'line-through text-gray-400' : ''}`}>
                                                {student.messBill.toLocaleString()}
                                            </td>
                                            <td className={`px-5 py-4 text-right font-medium ${student.isPaid ? 'line-through text-gray-400' : 'text-emerald-700'}`}>
                                                {student.amountPaid.toLocaleString()}
                                            </td>
                                            <td className={`px-5 py-4 text-right font-bold ${
                                                student.isPaid
                                                    ? 'line-through text-gray-400'
                                                    : student.balance > 0
                                                        ? 'text-red-600'
                                                        : 'text-emerald-600'
                                            }`}>
                                                {student.balance.toLocaleString()}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <button
                                                    id={`paid-toggle-${student.messNumber}`}
                                                    onClick={() => handleTogglePaid(student)}
                                                    disabled={togglingId === student.messNumber}
                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
                                                    style={{
                                                        background: student.isPaid ? '#d1fae5' : '#f3f4f6',
                                                        color: student.isPaid ? '#065f46' : '#6b7280',
                                                        border: student.isPaid ? '1px solid #6ee7b7' : '1px solid #e5e7eb',
                                                    }}
                                                    title={student.isPaid ? 'Mark as unpaid' : 'Mark as paid'}
                                                >
                                                    {togglingId === student.messNumber
                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                        : student.isPaid
                                                            ? <><CheckCircle2 className="w-3.5 h-3.5" /> Paid</>
                                                            : <><Circle className="w-3.5 h-3.5" /> Unpaid</>
                                                    }
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {/* Footer totals */}
                                <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-sm">
                                    <tr>
                                        <td className="px-5 py-4" />
                                        <td className="px-5 py-4 font-bold text-gray-900">Grand Total</td>
                                        <td className="px-5 py-4 text-right font-bold text-gray-900">
                                            {totalBill.toLocaleString()}
                                        </td>
                                        <td className="px-5 py-4 text-right font-bold text-emerald-700">
                                            {totalPaid.toLocaleString()}
                                        </td>
                                        <td className={`px-5 py-4 text-right font-bold ${totalBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {totalBalance.toLocaleString()}
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <span className="text-xs font-semibold text-gray-500">
                                                {paidCount}/{students.length} paid
                                            </span>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                            {studentRows.length === 0 && (
                                <div className="p-12 text-center text-gray-500">
                                    <IndianRupee className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                                    <p>No students found.</p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
