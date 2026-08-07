import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

export default function MealSuccessScreen({ studentName, messNumber, mealType, claimedAt, userMessType }) {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setExpired(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatClaimedAt = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `Claimed at ${d.toLocaleTimeString('en-US', {
      hour12: true,
      hour: 'numeric',
      minute: '2-digit'
    })}`;
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = (timeLeft % 60).toString().padStart(2, '0');

  const isNonVeg = userMessType && userMessType.toLowerCase() === 'non-veg';
  const bgGradient = isNonVeg
    ? "from-orange-500 via-amber-500 to-orange-700"
    : "from-emerald-500 via-emerald-600 to-teal-700";

  if (expired) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-600 to-gray-800 p-6 text-center transition-colors duration-1000">
        <div className="bg-white/10 p-8 rounded-3xl backdrop-blur-md shadow-2xl flex flex-col items-center w-full max-w-sm">
          <h1 className="text-4xl font-bold text-white mb-4">Token Expired</h1>
          <p className="text-white/80 mb-8">This meal token is no longer valid.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-white text-gray-900 rounded-xl px-8 py-4 font-bold text-lg hover:bg-gray-100 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full relative overflow-hidden bg-gradient-to-br ${bgGradient} animate-gradient-shift flex flex-col items-center justify-center p-6 text-center transition-colors duration-500`}>
      {/* Pulsing ring background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 bg-white/20 rounded-full animate-pulse-ring blur-xl"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center space-y-6 w-full max-w-sm">
        <CheckCircle2 className="w-20 h-20 text-white animate-bounce-in drop-shadow-md" />

        <div className="space-y-1 w-full">
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-sm line-clamp-1">{studentName}</h1>
          <p className="text-xl text-white/80 font-medium">Mess No: {messNumber}</p>
        </div>

        {mealType && (
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-6 py-2 text-white font-semibold text-lg shadow-sm border border-white/20">
            {mealType}
          </div>
        )}

        {/* Live ticking clock */}
        <div className="font-mono text-5xl font-bold text-white tracking-wider my-8 drop-shadow-lg tabular-nums">
          {formatTime(time)}
        </div>

        {/* Countdown */}
        <div className="flex flex-col items-center space-y-2 mt-4 bg-black/10 backdrop-blur-sm rounded-2xl p-4 w-full border border-white/10">
          <p className="text-white/90 text-lg font-medium">Token expires in {minutes}:{seconds}</p>
          <p className="text-white/70 text-sm">{formatClaimedAt(claimedAt)}</p>
        </div>
      </div>
    </div>
  );
}
