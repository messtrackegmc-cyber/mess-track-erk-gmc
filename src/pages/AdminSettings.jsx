import { useState, useEffect } from 'react';
import { useHostel } from '../context/HostelContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Save, Settings, DatabaseBackup, Download, Clock, Coffee, Sun, Moon, QrCode } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function AdminSettings() {
    const { messRate, cutoffTime, mealWindows, hostelName, updateSettings, loading } = useHostel();
    const { user } = useAuth();

    const [rate, setRate] = useState(messRate);
    const [cutoff, setCutoff] = useState(cutoffTime);
    const [isSaving, setIsSaving] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);

    // Meal windows states
    const [breakfastStart, setBreakfastStart] = useState(mealWindows?.breakfast?.start || '07:30');
    const [breakfastEnd, setBreakfastEnd] = useState(mealWindows?.breakfast?.end || '09:00');
    const [lunchStart, setLunchStart] = useState(mealWindows?.lunch?.start || '12:30');
    const [lunchEnd, setLunchEnd] = useState(mealWindows?.lunch?.end || '14:00');
    const [dinnerStart, setDinnerStart] = useState(mealWindows?.dinner?.start || '19:30');
    const [dinnerEnd, setDinnerEnd] = useState(mealWindows?.dinner?.end || '21:00');

    // Sync state when context loads
    useEffect(() => {
        setRate(messRate);
        setCutoff(cutoffTime);
        if (mealWindows) {
            setBreakfastStart(mealWindows.breakfast?.start || '07:30');
            setBreakfastEnd(mealWindows.breakfast?.end || '09:00');
            setLunchStart(mealWindows.lunch?.start || '12:30');
            setLunchEnd(mealWindows.lunch?.end || '14:00');
            setDinnerStart(mealWindows.dinner?.start || '19:30');
            setDinnerEnd(mealWindows.dinner?.end || '21:00');
        }
    }, [messRate, cutoffTime, mealWindows]);

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const parsedRate = parseInt(rate, 10);
        const parsedCutoff = parseInt(cutoff, 10);

        if (isNaN(parsedRate) || parsedRate < 0) {
            toast.error('Please enter a valid mess rate.');
            setIsSaving(false);
            return;
        }

        const result = await updateSettings({
            messRate: parsedRate,
            cutoffTime: parsedCutoff,
            mealWindows: {
                breakfast: { start: breakfastStart, end: breakfastEnd },
                lunch: { start: lunchStart, end: lunchEnd },
                dinner: { start: dinnerStart, end: dinnerEnd }
            }
        });

        if (result.success) {
            toast.success('Settings updated successfully');
        } else {
            toast.error('Failed to update settings: ' + (result.error || 'Unknown error'));
        }
        setIsSaving(false);
    };

    const handleBackup = async () => {
        if (!confirm('Download a full backup of your data?')) return;

        setIsBackingUp(true);
        const toastId = toast.loading('Generating backup...');

        try {
            // Fetch data from main tables
            const tables = ['students', 'leaves', 'weekly_menu'];
            const backupData = {
                timestamp: new Date().toISOString(),
                hostelName,
                data: {}
            };

            for (const table of tables) {
                const { data, error } = await supabase.from(table).select('*');
                if (error) throw error;
                backupData.data[table] = data;
            }

            // Create and download file
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mess_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('Backup downloaded successfully', { id: toastId });
        } catch (error) {
            console.error('Backup error:', error);
            toast.error('Backup failed: ' + error.message, { id: toastId });
        } finally {
            setIsBackingUp(false);
        }
    };

    if (loading) return <div className="p-8">Loading settings...</div>;

    return (
        <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
            <Toaster />

            {/* Page Header */}
            <div className="space-y-1">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Hostel Settings</h1>
                <p className="text-gray-500 text-base">Manage configuration for {hostelName || 'your hostel'}</p>
            </div>

            <Card className="border-gray-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-6">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                            <Settings className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">General Configuration</CardTitle>
                            <CardDescription className="mt-0.5">Update rates and timing restrictions.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 pt-6">
                    <form onSubmit={handleSave} className="space-y-8">

                        {/* Mess Rate */}
                        <div className="space-y-3">
                            <label className="block text-sm font-semibold text-gray-700">Daily Mess Rate</label>
                            <div className="relative max-w-xs">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm pointer-events-none">₹</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={rate}
                                    onChange={(e) => setRate(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all"
                                    required
                                />
                            </div>
                            <p className="text-xs text-gray-400">Amount charged per student per day.</p>
                        </div>

                        <div className="border-t border-gray-100" />

                        {/* Cutoff Time */}
                        <div className="space-y-3">
                            <label className="block text-sm font-semibold text-gray-700">Leave Cutoff Time</label>
                            <div className="max-w-xs">
                                <select
                                    value={cutoff}
                                    onChange={(e) => setCutoff(parseInt(e.target.value))}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all appearance-none cursor-pointer"
                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat', backgroundSize: '20px 20px' }}
                                >
                                    {Array.from({ length: 24 }).map((_, i) => (
                                        <option key={i} value={i}>
                                            {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                                            {i === 20 && ' (Default)'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-xs text-gray-400">
                                Students cannot apply for next-day leave after this time.
                            </p>
                        </div>

                        <div className="border-t border-gray-100" />

                        {/* Save */}
                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={isSaving} className="gap-2 px-6">
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Saving...' : 'Save Configuration'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Data Backup Section */}
            <Card className="border-gray-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-6">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                            <DatabaseBackup className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Data Backup</CardTitle>
                            <CardDescription className="mt-0.5">Download a complete copy of your data for safekeeping.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 pt-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h4 className="font-medium text-gray-900">Export All Data</h4>
                            <p className="text-sm text-gray-500 max-w-md">
                                Generates a JSON file containing all Students, Leaves, Menu, and Bills.
                                Save this file locally to prevent data loss.
                            </p>
                        </div>
                        <Button
                            onClick={handleBackup}
                            disabled={isBackingUp}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            {isBackingUp ? 'Exporting...' : 'Download Backup'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Meal Time Windows Section */}
            <Card className="border-gray-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-violet-50 border-b border-violet-100 p-6">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4 text-violet-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Meal Time Windows</CardTitle>
                            <CardDescription className="mt-0.5 text-violet-600/80">Configure when each meal is served. Students can only claim meals during these windows.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 pt-6">
                    <form onSubmit={handleSave} className="space-y-6">
                        {/* Breakfast */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Coffee className="w-5 h-5 text-blue-500" />
                                <span className="font-medium text-gray-700">Breakfast</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="time" value={breakfastStart} onChange={e => setBreakfastStart(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                <span className="text-gray-400 text-sm">to</span>
                                <input type="time" value={breakfastEnd} onChange={e => setBreakfastEnd(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                        </div>
                        
                        <div className="border-t border-gray-100" />

                        {/* Lunch */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Sun className="w-5 h-5 text-amber-500" />
                                <span className="font-medium text-gray-700">Lunch</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="time" value={lunchStart} onChange={e => setLunchStart(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                <span className="text-gray-400 text-sm">to</span>
                                <input type="time" value={lunchEnd} onChange={e => setLunchEnd(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                        </div>

                        <div className="border-t border-gray-100" />

                        {/* Dinner */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Moon className="w-5 h-5 text-indigo-500" />
                                <span className="font-medium text-gray-700">Dinner</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="time" value={dinnerStart} onChange={e => setDinnerStart(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                <span className="text-gray-400 text-sm">to</span>
                                <input type="time" value={dinnerEnd} onChange={e => setDinnerEnd(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSaving} className="gap-2">
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Saving...' : 'Save Settings'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* QR Code Section */}
            <Card className="border-gray-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-cyan-50 border-b border-cyan-100 p-6">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
                            <QrCode className="w-4 h-4 text-cyan-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Meal Check-in QR Code</CardTitle>
                            <CardDescription className="mt-0.5 text-cyan-700/80">Print this QR code and place it at the mess counter. Students scan it to claim their meals.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 pt-6">
                    <div className="flex flex-col items-center justify-center space-y-6">
                        <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-2xl">
                            {user?.hostelId && (
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window.location.origin}/claim-meal?hostel=${user.hostelId}`)}`} 
                                    alt="Check-in QR Code" 
                                    className="w-48 h-48"
                                />
                            )}
                        </div>
                        
                        <div className="w-full max-w-sm space-y-3">
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center break-all text-sm text-gray-600 font-mono">
                                {user?.hostelId ? `${window.location.origin}/claim-meal?hostel=${user.hostelId}` : 'Loading URL...'}
                            </div>
                            
                            <div className="flex gap-2 w-full">
                                <Button 
                                    variant="outline" 
                                    className="flex-1"
                                    onClick={() => {
                                        if (user?.hostelId) {
                                            navigator.clipboard.writeText(`${window.location.origin}/claim-meal?hostel=${user.hostelId}`);
                                            toast.success('URL copied to clipboard!');
                                        }
                                    }}
                                >
                                    Copy URL
                                </Button>
                                <Button 
                                    className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                                    onClick={() => {
                                        if (!user?.hostelId) return;
                                        const checkInUrl = `${window.location.origin}/claim-meal?hostel=${user.hostelId}`;
                                        const printWindow = window.open('', '_blank');
                                        printWindow.document.write(`
                                            <html>
                                            <head><title>Mess Check-in QR</title></head>
                                            <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;margin:0;padding:2rem;text-align:center;">
                                                <h1 style="font-size:2.5rem;margin-bottom:1rem;color:#111827;">Scan to Claim Your Meal</h1>
                                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(checkInUrl)}" style="width:400px;height:400px;margin:2rem 0;border:1rem solid white;box-shadow:0 0 20px rgba(0,0,0,0.1);border-radius:1rem;" />
                                                <p style="margin-top:1.5rem;font-size:1.25rem;color:#4B5563;">Open your Mess Track-E app and scan this code</p>
                                                <p style="margin-top:1rem;font-size:1rem;color:#9CA3AF;font-weight:bold;">${hostelName || 'Hostel Mess'}</p>
                                            </body>
                                            </html>
                                        `);
                                        printWindow.document.close();
                                        // Give the image a moment to load before printing
                                        setTimeout(() => {
                                            printWindow.print();
                                        }, 500);
                                    }}
                                >
                                    Print QR Poster
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
