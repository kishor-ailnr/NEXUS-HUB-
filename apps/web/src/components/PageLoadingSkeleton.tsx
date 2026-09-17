import React from 'react';
import { Skeleton } from './ui/skeleton';
import { Card, CardContent, CardHeader } from './ui/card';

export const PageLoadingSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="w-full flex justify-between items-center pb-4 border-b border-slate-200">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full py-8 space-y-6">
        {/* Banner Skeleton */}
        <div className="bg-navy/80 rounded-2xl p-6 sm:p-8 shadow-md">
          <Skeleton className="h-4 w-40 bg-white/20 mb-3" />
          <Skeleton className="h-8 w-64 bg-white/30 mb-2" />
          <Skeleton className="h-4 w-48 bg-white/20" />
        </div>

        {/* Cards Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-6 w-full" />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-6 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="text-center py-2 flex justify-center">
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
};
