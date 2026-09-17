import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  className?: string;
  fallbackTo?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({
  className = '',
  fallbackTo = '/',
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    // Check if there is history to go back to in the current session
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackTo);
    }
  };

  return (
    <button
      onClick={handleBack}
      type="button"
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 hover:text-navy-900 transition-colors focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-1 ${className}`}
      aria-label="Go back"
    >
      <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-navy-900" />
      <span>Back</span>
    </button>
  );
};
