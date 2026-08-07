import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const HostelContext = createContext(null);

// Default meal time windows
const DEFAULT_MEAL_WINDOWS = {
    breakfast: { start: '07:00', end: '10:00' },
    lunch: { start: '12:00', end: '15:00' },
    dinner: { start: '19:00', end: '22:00' },
};

export function HostelProvider({ children }) {
    const { user } = useAuth();
    const [hostelSettings, setHostelSettings] = useState({
        messRate: 140, // Default fallback
        cutoffTime: 20, // Default fallback (8 PM)
        hostelName: '',
        maxLeaves: 10, // Default fallback (null = unlimited)
        mealWindows: DEFAULT_MEAL_WINDOWS,
        loading: true,
    });

    useEffect(() => {
        const fetchHostelSettings = async () => {
            if (!user?.hostelId) {
                setHostelSettings(prev => ({ ...prev, loading: false }));
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('hostels')
                    .select('name, mess_rate, cutoff_time, breakfast_start, breakfast_end, lunch_start, lunch_end, dinner_start, dinner_end')
                    .eq('id', user.hostelId)
                    .single();

                if (error) {
                    console.error('Error fetching hostel settings:', error);
                    // Keep defaults but stop loading
                    setHostelSettings(prev => ({ ...prev, loading: false }));
                    return;
                }

                if (data) {
                    setHostelSettings({
                        messRate: data.mess_rate,
                        cutoffTime: data.cutoff_time,
                        hostelName: data.name,
                        maxLeaves: null, // Hardcoded to unlimited leaves
                        mealWindows: {
                            breakfast: {
                                start: data.breakfast_start || '07:00',
                                end: data.breakfast_end || '10:00',
                            },
                            lunch: {
                                start: data.lunch_start || '12:00',
                                end: data.lunch_end || '15:00',
                            },
                            dinner: {
                                start: data.dinner_start || '19:00',
                                end: data.dinner_end || '22:00',
                            },
                        },
                        loading: false,
                    });
                }
            } catch (err) {
                console.error('Unexpected error fetching hostel settings:', err);
                setHostelSettings(prev => ({ ...prev, loading: false }));
            }
        };

        fetchHostelSettings();
    }, [user?.hostelId]);

    // Function to update settings (for Admin)
    const updateSettings = async (newSettings) => {
        if (!user?.hostelId) return { success: false, error: 'No hostel ID found for user' };

        try {
            // Build the update payload
            const updatePayload = {
                mess_rate: newSettings.messRate,
                cutoff_time: newSettings.cutoffTime,
            };

            // Include meal window updates if provided
            if (newSettings.mealWindows) {
                updatePayload.breakfast_start = newSettings.mealWindows.breakfast.start;
                updatePayload.breakfast_end = newSettings.mealWindows.breakfast.end;
                updatePayload.lunch_start = newSettings.mealWindows.lunch.start;
                updatePayload.lunch_end = newSettings.mealWindows.lunch.end;
                updatePayload.dinner_start = newSettings.mealWindows.dinner.start;
                updatePayload.dinner_end = newSettings.mealWindows.dinner.end;
            }

            const { error } = await supabase
                .from('hostels')
                .update(updatePayload)
                .eq('id', user.hostelId);

            if (error) throw error;

            // Optimistically update local state
            setHostelSettings(prev => ({
                ...prev,
                messRate: newSettings.messRate,
                cutoffTime: newSettings.cutoffTime,
                ...(newSettings.mealWindows && { mealWindows: newSettings.mealWindows }),
            }));

            return { success: true };
        } catch (err) {
            console.error('Error updating hostel settings:', err);
            return { success: false, error: err.message };
        }
    };

    return (
        <HostelContext.Provider value={{ ...hostelSettings, updateSettings }}>
            {children}
        </HostelContext.Provider>
    );
}

export function useHostel() {
    const context = useContext(HostelContext);
    if (!context) {
        throw new Error('useHostel must be used within a HostelProvider');
    }
    return context;
}
