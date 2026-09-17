import React from 'react';
import { Link } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Compass, Home } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6">
      <div className="w-full">
        <BackButton fallbackTo="/" />
      </div>

      <div className="flex-1 flex items-center justify-center my-8">
        <Card className="max-w-md w-full border-slate-200 shadow-xl text-center">
          <CardHeader className="pb-2">
            <div className="w-14 h-14 bg-navy/5 text-navy rounded-full flex items-center justify-center mx-auto mb-3">
              <Compass className="w-7 h-7 text-navy animate-pulse" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">404 Error</span>
            <CardTitle className="text-2xl mt-1">Route Not Found</CardTitle>
            <CardDescription className="text-sm mt-1">
              The requested transport mode or route does not exist within the NEXUS WAYS network.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-2">
            <p className="text-xs text-slate-500">
              Valid modes are <strong>roadways</strong>, <strong>railways</strong>, <strong>airways</strong>, and <strong>seaways</strong>.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center pt-3">
            <Button asChild className="gap-2">
              <Link to="/">
                <Home className="w-4 h-4" />
                <span>Return to Hub</span>
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="text-center text-xs text-slate-400 py-2">
        NEXUS WAYS &bull; Multimodal Platform
      </div>
    </div>
  );
};
