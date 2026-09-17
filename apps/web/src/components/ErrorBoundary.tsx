import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in NEXUS WAYS application:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <Card className="max-w-md w-full border-slate-200 shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="w-12 h-12 bg-status-critical-light text-status-critical rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <CardTitle className="text-xl">Something went wrong</CardTitle>
              <CardDescription className="text-sm">
                An unexpected application error occurred while loading this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-2">
              {this.state.error && (
                <div className="bg-slate-100 p-3 rounded-lg text-xs font-mono text-slate-700 text-left overflow-auto max-h-32 mb-2">
                  {this.state.error.message || 'Unknown error'}
                </div>
              )}
              <p className="text-xs text-slate-500">
                You can try reloading the view or navigate back to the main transport portal.
              </p>
            </CardContent>
            <CardFooter className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={this.handleReload} className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload</span>
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <a href="/">
                  <Home className="w-3.5 h-3.5" />
                  <span>Back to Hub</span>
                </a>
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
