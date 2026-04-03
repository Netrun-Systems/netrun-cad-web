/**
 * LoginModal — authentication overlay for Survai Construction.
 * Includes a "Demo Mode" bypass for presentation demos.
 */

import React, { useState } from 'react';
import { api } from '../../services/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const tokens = await api.login(email, password);
      localStorage.setItem('survai_access_token', tokens.access_token);
      if (tokens.refresh_token) {
        localStorage.setItem('survai_refresh_token', tokens.refresh_token);
      }
      onLoginSuccess();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Check your credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = () => {
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 border border-gray-700">
        {/* Header */}
        <div className="px-6 pt-6 pb-2 text-center">
          <h2 className="text-xl font-bold text-white">Sign in to Survai</h2>
          <p className="text-gray-400 text-sm mt-1">
            Construction CAD + 3D Scan Platform
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg
                         text-white placeholder-gray-500 text-sm
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg
                         text-white placeholder-gray-500 text-sm
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600
                       text-white font-medium rounded-lg text-sm transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-gray-800 text-gray-500">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDemoMode}
            className="w-full py-2.5 bg-gray-700 hover:bg-gray-600
                       text-gray-300 font-medium rounded-lg text-sm transition-colors
                       border border-gray-600"
          >
            Demo Mode
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
