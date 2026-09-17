import React from 'react';
import { BackButton } from '../components/BackButton';

interface PlaceholderProps {
  title: string;
}

export const Placeholder: React.FC<PlaceholderProps> = ({ title }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-6">
      <div className="w-full">
        <BackButton fallbackTo="/" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <span className="inline-block px-3 py-1 bg-navy/10 text-navy font-semibold text-xs rounded-full uppercase tracking-wider mb-3">
          {title}
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-navy mb-2">{title}</h1>
        <p className="text-slate-500 text-sm">Coming in a later phase</p>
      </div>

      <div className="text-center text-xs text-slate-400 py-2">
        NEXUS WAYS &bull; Multimodal Platform
      </div>
    </div>
  );
};
