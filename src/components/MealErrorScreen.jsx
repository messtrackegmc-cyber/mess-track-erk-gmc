import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export default function MealErrorScreen({ errorMessage, mealType }) {
  const navigate = useNavigate();

  const handleTryAgain = () => {
    // Hard reload — bypasses PWA cache and resets hasClaimed ref in ClaimMeal
    const currentUrl = window.location.href;
    // Force a clean navigation to the same URL
    window.location.replace(currentUrl);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-red-500 via-red-600 to-rose-700 p-6 text-center">
      <div className="relative z-10 flex flex-col items-center space-y-8 max-w-md w-full">
        <XCircle className="w-20 h-20 text-white animate-bounce-in drop-shadow-md" />

        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-sm">Claim Denied</h1>
          {errorMessage && (
            <p className="text-lg text-white/90 max-w-sm mx-auto leading-relaxed">
              {errorMessage}
            </p>
          )}
        </div>

        {mealType && (
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-white font-medium border border-white/20 shadow-sm">
            {mealType}
          </div>
        )}

        <div className="flex flex-row gap-4 pt-6 w-full justify-center">
          <button
            onClick={handleTryAgain}
            className="flex-1 bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-xl px-6 py-3 font-semibold hover:bg-white/30 transition-colors shadow-sm"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 bg-white text-red-600 rounded-xl px-6 py-3 font-semibold hover:bg-white/90 transition-colors shadow-lg"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
