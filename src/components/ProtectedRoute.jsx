import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRole }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3 bg-white p-6 rounded-2xl shadow-md border border-slate-200">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-700">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // If unauthenticated, redirect to Landing/Login page (/)
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // If user role doesn't match allowedRole, route them to their appropriate dashboard
  if (allowedRole && role && role !== allowedRole) {
    return <Navigate to={role === 'provider' ? '/provider' : '/customer'} replace />;
  }

  return children;
}
