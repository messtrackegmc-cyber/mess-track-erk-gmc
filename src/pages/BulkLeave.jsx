import { useState, useMemo, useCallback } from 'react';
import { useStudents } from '../context/StudentContext';
import { useAuth } from '../context/AuthContext';
import { useLeaves } from '../context/LeaveContext';
import { supabase } from '../lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import toast, { Toaster } from 'react-hot-toast';
import {
    Search,
    CheckSquare,
    Square,
    CalendarRange,
    Users,
    CheckCircle2,
    XCircle,
    ChevronRight,
    CalendarCheck,
    AlertTriangle,
    UserCheck,
    X,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDateKey = (date) => date.toISOString().split('T')[0];

const dateRangeDates = (start, end) => {
    const dates = [];
    const cur = new Date(start);
    const last = new Date(end);
    while (cur <= last) {
        dates.push(formatDateKey(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
};

const BATCH_SIZE = 100;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StudentRow({ student, isSelected, onToggle }) {
    return (
        <button
            type="button"
            onClick={() => onToggle(student.messNumber)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 border ${
                isSelected
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                    : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200 text-gray-700'
            }`}
        >
            {isSelected ? (
                <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            ) : (
                <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
            )}
            <span className="flex-1 text-sm font-medium truncate">{student.name}</span>
            <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono flex-shrink-0 ${
                    isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                }`}
            >
                #{student.messNumber}
            </span>
        </button>
    );
}

function SummaryBanner({ selectedCount, dateCount, action }) {
    const total = selectedCount * dateCount;
    if (selectedCount === 0 || dateCount === 0) return null;
    return (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm">
            <CalendarCheck className="w-4 h-4 flex-shrink-0" />
            <span>
                <strong>{selectedCount}</strong> student{selectedCount !== 1 ? 's' : ''} ×{' '}
                <strong>{dateCount}</strong> day{dateCount !== 1 ? 's' : ''} ={' '}
                <strong>{total}</strong> leave record{total !== 1 ? 's' : ''} will be{' '}
                {action === 'grant' ? 'created' : 'removed'}
            </span>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BulkLeave() {
    const { students, loading: studentsLoading } = useStudents();
    const { user } = useAuth();
    const { refreshLeaves } = useLeaves();

    // ── Student selection state ──────────────────────────────────────────────
    const [search, setSearch] = useState('');
    const [selectedMessNumbers, setSelectedMessNumbers] = useState(new Set());

    // ── Date range state ─────────────────────────────────────────────────────
    const today = formatDateKey(new Date());
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);

    // ── Result state ─────────────────────────────────────────────────────────
    const [result, setResult] = useState(null); // { action, count, errors }
    const [loading, setLoading] = useState(false);

    // ── Derived data ─────────────────────────────────────────────────────────
    const activeStudents = useMemo(
        () => students.filter((s) => s.messStatus === 'Active'),
        [students]
    );

    const filteredStudents = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return activeStudents;
        return activeStudents.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.messNumber.toLowerCase().includes(q)
        );
    }, [activeStudents, search]);

    const dateCount = useMemo(() => {
        if (!startDate || !endDate) return 0;
        const s = new Date(startDate);
        const e = new Date(endDate);
        if (s > e) return 0;
        return Math.floor((e - s) / 86400000) + 1;
    }, [startDate, endDate]);

    const selectedCount = selectedMessNumbers.size;
    const totalRecords = selectedCount * dateCount;

    // ── Selection handlers ───────────────────────────────────────────────────
    const toggleStudent = useCallback((messNumber) => {
        setSelectedMessNumbers((prev) => {
            const next = new Set(prev);
            if (next.has(messNumber)) next.delete(messNumber);
            else next.add(messNumber);
            return next;
        });
        setResult(null);
    }, []);

    const selectAll = () => {
        setSelectedMessNumbers(new Set(filteredStudents.map((s) => s.messNumber)));
        setResult(null);
    };

    const deselectAll = () => {
        setSelectedMessNumbers(new Set());
        setResult(null);
    };

    // ── Validation ───────────────────────────────────────────────────────────
    const validate = () => {
        if (selectedCount === 0) {
            toast.error('Please select at least one student');
            return false;
        }
        if (!startDate || !endDate) {
            toast.error('Please select both start and end dates');
            return false;
        }
        if (new Date(startDate) > new Date(endDate)) {
            toast.error('Start date must be on or before end date');
            return false;
        }
        return true;
    };

    // ── Grant handler ─────────────────────────────────────────────────────────
    const handleGrant = async () => {
        if (!validate()) return;

        const selectedStudents = activeStudents.filter((s) =>
            selectedMessNumbers.has(s.messNumber)
        );
        const dates = dateRangeDates(new Date(startDate), new Date(endDate));

        if (
            !window.confirm(
                `Grant leave for ${selectedCount} student(s) for ${dates.length} day(s)?\n` +
                    `${startDate} → ${endDate}\n\n` +
                    `Total records: ${totalRecords}\n` +
                    `These will NOT count towards the monthly quota.`
            )
        )
            return;

        setLoading(true);
        setResult(null);
        toast.loading(`Granting ${totalRecords} leave(s)…`, { id: 'bulk-leave' });

        // Build flat records array
        const records = selectedStudents.flatMap((student) =>
            dates.map((dateKey) => ({
                student_id: student.id,
                mess_number: student.messNumber,
                leave_date: dateKey,
                status: 'Approved',
                hostel_id: user.hostelId,
                is_admin_granted: true,
            }))
        );

        let successCount = 0;
        let hasError = false;
        let errorMsg = '';

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
            const messNumbersInBatch = [...new Set(batch.map((r) => r.mess_number))];

            // Delete existing first to avoid duplicates
            await supabase
                .from('leaves')
                .delete()
                .in('mess_number', messNumbersInBatch)
                .in('leave_date', dates)
                .eq('hostel_id', user.hostelId);

            const { error } = await supabase.from('leaves').insert(batch);
            if (error) {
                hasError = true;
                errorMsg = error.message;
                break;
            }
            successCount += batch.length;
        }

        setLoading(false);

        if (hasError) {
            toast.error(`Failed: ${errorMsg}`, { id: 'bulk-leave' });
            setResult({ action: 'grant', count: successCount, error: errorMsg });
        } else {
            toast.success(`Granted ${successCount} leave(s) successfully!`, { id: 'bulk-leave' });
            setResult({ action: 'grant', count: successCount, error: null });
            setSelectedMessNumbers(new Set());
        }

        if (refreshLeaves) refreshLeaves();
    };

    // ── Cancel handler ────────────────────────────────────────────────────────
    const handleCancel = async () => {
        if (!validate()) return;

        const messNumbers = [...selectedMessNumbers];
        const dates = dateRangeDates(new Date(startDate), new Date(endDate));

        if (
            !window.confirm(
                `Cancel leave for ${selectedCount} student(s) for ${dates.length} day(s)?\n` +
                    `${startDate} → ${endDate}\n\n` +
                    `This will remove up to ${totalRecords} leave record(s).`
            )
        )
            return;

        setLoading(true);
        setResult(null);
        toast.loading(`Cancelling leaves…`, { id: 'bulk-cancel' });

        // Delete in batches (by mess_number groups)
        let hasError = false;
        let errorMsg = '';
        const MESS_BATCH = 50;
        let deletedCount = 0;

        for (let i = 0; i < messNumbers.length; i += MESS_BATCH) {
            const batch = messNumbers.slice(i, i + MESS_BATCH);
            const { error, count } = await supabase
                .from('leaves')
                .delete({ count: 'exact' })
                .in('mess_number', batch)
                .in('leave_date', dates)
                .eq('hostel_id', user.hostelId);

            if (error) {
                hasError = true;
                errorMsg = error.message;
                break;
            }
            deletedCount += count ?? 0;
        }

        setLoading(false);

        if (hasError) {
            toast.error(`Failed: ${errorMsg}`, { id: 'bulk-cancel' });
            setResult({ action: 'cancel', count: deletedCount, error: errorMsg });
        } else {
            toast.success(`Cancelled ${deletedCount} leave record(s)`, { id: 'bulk-cancel' });
            setResult({ action: 'cancel', count: deletedCount, error: null });
            setSelectedMessNumbers(new Set());
        }

        if (refreshLeaves) refreshLeaves();
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 animate-fade-in">
            <Toaster />

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Bulk Leave</h1>
                    <p className="text-gray-500 mt-1">
                        Select specific students, choose a date range, and grant or cancel leaves in one
                        action.
                    </p>
                </div>
                {selectedCount > 0 && (
                    <Badge className="bg-indigo-600 text-white text-sm px-3 py-1.5 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" />
                        {selectedCount} selected
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Left: Student Picker ───────────────────────────────── */}
                <div className="lg:col-span-2">
                    <Card className="h-full flex flex-col">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="w-5 h-5 text-indigo-600" />
                                        Select Students
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        {studentsLoading
                                            ? 'Loading students…'
                                            : `${activeStudents.length} active student${activeStudents.length !== 1 ? 's' : ''}`}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAll}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                                    >
                                        Select all
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button
                                        type="button"
                                        onClick={deselectAll}
                                        className="text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors"
                                    >
                                        Deselect all
                                    </button>
                                </div>
                            </div>

                            {/* Search bar */}
                            <div className="relative mt-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name or mess number…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full text-sm pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="flex-1 overflow-hidden">
                            {studentsLoading ? (
                                <div className="space-y-2">
                                    {[...Array(6)].map((_, i) => (
                                        <Skeleton key={i} className="h-10 w-full rounded-lg" />
                                    ))}
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                    <Search className="w-10 h-10 mb-3 opacity-30" />
                                    <p className="text-sm">No students match your search</p>
                                </div>
                            ) : (
                                <div
                                    className="overflow-y-auto space-y-1 pr-1"
                                    style={{ maxHeight: '420px' }}
                                >
                                    {filteredStudents.map((student) => (
                                        <StudentRow
                                            key={student.id}
                                            student={student}
                                            isSelected={selectedMessNumbers.has(student.messNumber)}
                                            onToggle={toggleStudent}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ── Right: Date Range + Actions ────────────────────────── */}
                <div className="space-y-4">
                    {/* Date Range Card */}
                    <Card className="border-l-4 border-l-indigo-500">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarRange className="w-5 h-5 text-indigo-600" />
                                Date Range
                            </CardTitle>
                            <CardDescription>
                                Leaves will be granted for every day in this range.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Start Date</label>
                                <input
                                    type="date"
                                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setResult(null);
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">End Date</label>
                                <input
                                    type="date"
                                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setResult(null);
                                    }}
                                />
                            </div>

                            {/* Day count pill */}
                            {dateCount > 0 ? (
                                <div className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 rounded-md px-3 py-2">
                                    <CalendarCheck className="w-3.5 h-3.5" />
                                    <span>
                                        <strong>{dateCount}</strong> day{dateCount !== 1 ? 's' : ''} selected
                                    </span>
                                </div>
                            ) : new Date(startDate) > new Date(endDate) ? (
                                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>End date must be after start date</span>
                                </div>
                            ) : null}

                            {/* Scope summary */}
                            <SummaryBanner
                                selectedCount={selectedCount}
                                dateCount={dateCount}
                                action="grant"
                            />
                        </CardContent>
                    </Card>

                    {/* Action Buttons Card */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2"
                                onClick={handleGrant}
                                disabled={loading || selectedCount === 0 || dateCount === 0}
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                {loading ? 'Processing…' : 'Grant Bulk Leave'}
                            </Button>
                            <Button
                                variant="destructive"
                                className="w-full flex items-center justify-center gap-2"
                                onClick={handleCancel}
                                disabled={loading || selectedCount === 0 || dateCount === 0}
                            >
                                <XCircle className="w-4 h-4" />
                                Cancel Bulk Leave
                            </Button>

                            {selectedCount === 0 && (
                                <p className="text-xs text-center text-gray-400 pt-1">
                                    Select at least one student to proceed
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Result summary card */}
                    {result && (
                        <Card
                            className={`border-l-4 ${
                                result.error
                                    ? 'border-l-red-500 bg-red-50'
                                    : result.action === 'grant'
                                    ? 'border-l-emerald-500 bg-emerald-50'
                                    : 'border-l-amber-500 bg-amber-50'
                            }`}
                        >
                            <CardContent className="pt-4">
                                <div className="flex items-start gap-3">
                                    {result.error ? (
                                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    ) : result.action === 'grant' ? (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div>
                                        <p
                                            className={`text-sm font-semibold ${
                                                result.error
                                                    ? 'text-red-800'
                                                    : result.action === 'grant'
                                                    ? 'text-emerald-800'
                                                    : 'text-amber-800'
                                            }`}
                                        >
                                            {result.error
                                                ? 'Partial failure'
                                                : result.action === 'grant'
                                                ? 'Leave granted!'
                                                : 'Leave cancelled!'}
                                        </p>
                                        <p
                                            className={`text-xs mt-0.5 ${
                                                result.error
                                                    ? 'text-red-600'
                                                    : result.action === 'grant'
                                                    ? 'text-emerald-700'
                                                    : 'text-amber-700'
                                            }`}
                                        >
                                            {result.error
                                                ? `${result.count} record(s) processed before error: ${result.error}`
                                                : `${result.count} record(s) ${result.action === 'grant' ? 'created' : 'removed'} successfully`}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Quick tip */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-500">
                            Bulk leaves are admin-granted and bypass the monthly quota. They are marked with a
                            purple dot in Leave Reports.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
