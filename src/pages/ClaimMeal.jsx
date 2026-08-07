import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useHostel } from '../context/HostelContext';
import { useLeaves } from '../context/LeaveContext';
import { supabase } from '../lib/supabaseClient';
import MealSuccessScreen from '../components/MealSuccessScreen';
import MealErrorScreen from '../components/MealErrorScreen';
import { Loader2 } from 'lucide-react';

export default function ClaimMeal() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { loading: hostelLoading, mealWindows } = useHostel();
  const { isStudentOnLeave } = useLeaves();

  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [mealType, setMealType] = useState('');
  const [claimedAt, setClaimedAt] = useState('');
  
  // Use a ref to prevent double execution in Strict Mode
  const hasClaimed = useRef(false);

  useEffect(() => {
    const claimMeal = async () => {
      if (hasClaimed.current || hostelLoading || !user) return;
      hasClaimed.current = true;

      try {
        const hostelId = searchParams.get('hostel');
        
        if (!hostelId) {
          setErrorMessage('Invalid QR code');
          setStatus('error');
          return;
        }

        if (user.hostelId !== hostelId) {
          setErrorMessage('This QR code is for a different hostel');
          setStatus('error');
          return;
        }

        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        let detectedMeal = null;

        if (mealWindows) {
          for (const [meal, window] of Object.entries(mealWindows)) {
            if (currentTime >= window.start && currentTime < window.end) {
              // Capitalize meal name
              detectedMeal = meal.charAt(0).toUpperCase() + meal.slice(1);
              break;
            }
          }
        }

        if (!detectedMeal) {
          setErrorMessage('No meal is currently being served. Check the meal schedule.');
          setStatus('error');
          return;
        }

        setMealType(detectedMeal);

        const today = new Date().toLocaleDateString('en-CA');
        const onLeave = isStudentOnLeave(user.messNumber, today);
        
        if (onLeave) {
          setErrorMessage('You are marked on leave today. Cancel your leave first.');
          setStatus('error');
          return;
        }

        const { error } = await supabase.from('meal_claims').insert([{
          student_id: user.id,
          mess_number: user.messNumber,
          hostel_id: user.hostelId,
          meal_type: detectedMeal,
          claim_date: today,
        }]);

        if (error) {
          if (error.code === '23505') {
            setErrorMessage(`You have already claimed ${detectedMeal} today`);
          } else {
            setErrorMessage(error.message || 'Failed to claim meal. Please try again.');
          }
          setStatus('error');
          return;
        }

        setClaimedAt(new Date().toISOString());
        setStatus('success');

      } catch (err) {
        console.error('Claim Error:', err);
        setErrorMessage(err.message || 'An unexpected error occurred');
        setStatus('error');
      }
    };

    claimMeal();
  }, [user, hostelLoading, mealWindows, isStudentOnLeave, searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-6">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
        <p className="text-gray-600 text-lg font-medium animate-pulse">Verifying your meal...</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <MealSuccessScreen 
        studentName={user?.name || 'Student'} 
        messNumber={user?.messNumber} 
        mealType={mealType} 
        claimedAt={claimedAt} 
        userMessType={user?.messType}
      />
    );
  }

  return <MealErrorScreen errorMessage={errorMessage} mealType={mealType} />;
}
