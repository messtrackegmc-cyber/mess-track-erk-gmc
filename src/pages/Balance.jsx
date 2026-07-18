import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useHostel } from '../context/HostelContext';
import {
    Receipt, Wallet, TrendingDown, ChevronLeft, ChevronRight,
    CheckCircle2, Lock, Loader2, IndianRupee, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function Balance() {
    const { user } = useAuth();
    const { messRate } = useHostel();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [monthLeaves, setMonthLeaves] = useState([]);
    const [loadingLeaves, setLoadingLeaves] = useState(false);

    // Payment state
    const [amountPaid, setAmountPaid] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [isLocked, setIsLocked] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingPayment, setLoadingPayment] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    if (!user) return <div className="p-8 text-center">Please log in to view balance.</div>;

    const now = new Date();
    const currentYear = selectedDate.getFullYear();
    const currentMonth = selectedDate.getMonth();
    const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();
    const isMinMonth = currentYear === 2025 && currentMonth === 0;

    const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthName = selectedDate.toLocaleString('default', { month: 'long' });

    const handlePrevMonth = () => {
        if (isMinMonth) return;
        setSelectedDate(new Date(currentYear, currentMonth - 1, 1));
    };
    const handleNextMonth = () => setSelectedDate(new Date(currentYear, currentMonth + 1, 1));

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Fetch leaves for selected month
    useEffect(() => {
        if (!user?.hostelId || !user?.messNumber) return;

        const fetchMonthLeaves = async () => {
            setLoadingLeaves(true);
            const startStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
            const endStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

            const { data, error } = await supabase
                .from('leaves')
                .select('leave_date')
                .eq('status', 'Approved')
                .eq('hostel_id', user.hostelId)
                .eq('mess_number', user.messNumber)
                .gte('leave_date', startStr)
                .lte('leave_date', endStr);

            if (error) {
                console.error(error);
                setMonthLeaves([]);
            } else {
                setMonthLeaves(data.map(d => d.leave_date));
            }
            setLoadingLeaves(false);
        };
        fetchMonthLeaves();
    }, [user?.hostelId, user?.messNumber, currentYear, currentMonth, daysInMonth]);

    // Fetch saved payment for selected month
    useEffect(() => {
        if (!user?.hostelId || !user?.messNumber) return;

        const fetchPayment = async () => {
            setLoadingPayment(true);
            setSaveSuccess(false);
            const { data, error } = await supabase
                .from('gpay_payments')
                .select('amount_paid, is_paid')
                .eq('hostel_id', user.hostelId)
                .eq('mess_number', user.messNumber)
                .eq('month', monthKey)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error(error);
            }

            if (data) {
                setAmountPaid(data.amount_paid ?? 0);
                setInputValue('');
                setIsLocked(data.is_paid ?? false);
            } else {
                setAmountPaid(0);
                setInputValue('');
                setIsLocked(false);
            }
            setLoadingPayment(false);
        };
        fetchPayment();
    }, [user?.hostelId, user?.messNumber, monthKey]);

    // Bill calculation
    let leaveCount = 0;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (monthLeaves.includes(dateKey)) leaveCount++;
    }
    const activeDays = daysInMonth - leaveCount;
    const messBill = activeDays * messRate;
    const currentTotalPaid = Number(amountPaid) || 0;
    const newPayment = Number(inputValue) || 0;
    const paid = currentTotalPaid + newPayment;
    const balance = messBill - paid;

    const handleSave = async () => {
        const val = newPayment + currentTotalPaid;
        if (isNaN(newPayment) || newPayment <= 0 || val > messBill) return;

        setSaving(true);
        const { error } = await supabase
            .from('gpay_payments')
            .upsert({
                hostel_id: user.hostelId,
                mess_number: user.messNumber,
                month: monthKey,
                amount_paid: val,
            }, {
                onConflict: 'hostel_id,mess_number,month',
                ignoreDuplicates: false,
            });

        if (!error) {
            setAmountPaid(val);
            setInputValue('');
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } else {
            console.error('Save error:', error);
        }
        setSaving(false);
    };

    const isLoading = loadingLeaves || loadingPayment;

    return (
        <div className="space-y-8 animate-fade-in mx-auto max-w-4xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">My Balance</h1>
                    <p className="text-gray-500 text-lg">Payment details for {monthName} {currentYear}</p>
                </div>
                {/* Month Navigator */}
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrevMonth} disabled={isMinMonth}>
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

            {/* Loading State */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                </div>
            ) : (
                <>
                    {/* Three Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                        {/* Card 1: Mess Bill */}
                        <Card className="border-gray-200 shadow-sm overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50/40">
                            <CardHeader className="pb-2 pt-5 px-5">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <Receipt className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <CardTitle className="text-sm font-semibold text-blue-700 uppercase tracking-wider">
                                        Mess Bill
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="px-5 pb-5">
                                <p className="text-4xl font-bold text-gray-900 mt-1">
                                    ₹{messBill.toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                    {activeDays} billable days × ₹{messRate}/day
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    ({daysInMonth} total − {leaveCount} leave days)
                                </p>
                            </CardContent>
                        </Card>

                        {/* Card 2: Amount Paid */}
                        <Card className="border-gray-200 shadow-sm overflow-hidden bg-gradient-to-br from-emerald-50 to-green-50/40">
                            <CardHeader className="pb-2 pt-5 px-5">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                        {isLocked
                                            ? <Lock className="w-4 h-4 text-emerald-600" />
                                            : <Wallet className="w-4 h-4 text-emerald-600" />
                                        }
                                    </div>
                                    <CardTitle className="text-sm font-semibold text-emerald-700 uppercase tracking-wider">
                                        Amount Paid
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="px-5 pb-5">
                                {isLocked ? (
                                    <div>
                                        <p className="text-4xl font-bold text-gray-900 mt-1">
                                            ₹{Number(amountPaid).toLocaleString()}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-3">
                                            <Lock className="w-3 h-3 text-emerald-600" />
                                            <p className="text-xs text-emerald-600 font-medium">Payment verified & locked</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-1">
                                        {Number(amountPaid) > 0 && (
                                            <div className="mb-3">
                                                <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wider mb-0.5">Total Paid So Far</p>
                                                <p className="text-2xl font-bold text-gray-900">₹{Number(amountPaid).toLocaleString()}</p>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-xl px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-emerald-300 transition-all">
                                            <IndianRupee className="w-4 h-4 text-emerald-500 shrink-0" />
                                            <input
                                                type="number"
                                                min="0"
                                                max={messBill - currentTotalPaid}
                                                placeholder="Add new payment..."
                                                value={inputValue}
                                                onChange={(e) => setInputValue(e.target.value)}
                                                className="w-full text-lg font-semibold text-gray-900 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-gray-400 placeholder:text-base placeholder:font-medium"
                                                id="amount-paid-input"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleSave}
                                            disabled={saving || inputValue === '' || Number(inputValue) <= 0 || balance < 0}
                                            className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium h-9"
                                        >
                                            {saving
                                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                                                : saveSuccess
                                                    ? <><CheckCircle2 className="w-4 h-4 mr-2" />Saved!</>
                                                    : 'Save Amount'
                                            }
                                        </Button>
                                        {balance < 0 ? (
                                            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3 shrink-0" />
                                                Payment exceeds total bill.
                                            </p>
                                        ) : (
                                            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3 shrink-0" />
                                                You can update this until verified by admin.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Card 3: Balance to be Paid */}
                        <Card className={`border-gray-200 shadow-sm overflow-hidden bg-gradient-to-br ${balance > 0 ? 'from-red-50 to-rose-50/40' : 'from-emerald-50 to-green-50/40'}`}>
                            <CardHeader className="pb-2 pt-5 px-5">
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${balance > 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
                                        <TrendingDown className={`w-4 h-4 ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
                                    </div>
                                    <CardTitle className={`text-sm font-semibold uppercase tracking-wider ${balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                        Balance to be Paid
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="px-5 pb-5">
                                <p className={`text-4xl font-bold mt-1 ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    ₹{Math.abs(balance).toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                    {balance > 0
                                        ? `₹${messBill.toLocaleString()} bill − ₹${paid.toLocaleString()} paid`
                                        : balance < 0
                                            ? `Overpaid by ₹${Math.abs(balance).toLocaleString()}`
                                            : 'Fully settled!'
                                    }
                                </p>
                                {balance === 0 && paid > 0 && (
                                    <div className="flex items-center gap-1.5 mt-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        <p className="text-xs text-emerald-600 font-semibold">All cleared!</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Summary formula */}
                    <div className="bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 text-sm text-gray-500">
                        <p className="font-mono text-center">
                            Mess Bill (₹{messBill.toLocaleString()}) − Amount Paid (₹{paid.toLocaleString()}) ={' '}
                            <span className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                ₹{balance.toLocaleString()}
                            </span>
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
