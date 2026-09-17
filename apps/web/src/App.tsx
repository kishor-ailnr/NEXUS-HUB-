import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Hub } from './pages/Hub';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { NotFound } from './pages/NotFound';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/sonner';

export const App: React.FC = () => {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Real Multimodal Hub Page */}
          <Route path="/" element={<Hub />} />

          {/* Parameterized Generic Auth & Operation Routes */}
          <Route path="/:mode/login" element={<Login />} />
          <Route path="/:mode/register" element={<Register />} />
          <Route
            path="/:mode/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback & 404 Route */}
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </ErrorBoundary>
  );
};

export default App;
