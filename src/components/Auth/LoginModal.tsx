/**
 * LoginModal — authentication overlay for Survai Construction.
 * Primary: Google sign-in (federated — same account for Drive + Survai API).
 * Fallback: Email/password login.
 * Bypass: "Demo Mode" for presentations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

// Window.google type is declared in google-drive.ts — we access it via `any` cast
type GoogleAccounts = {
  id: {
    initialize: (config: Record<string, unknown>) => void;
    renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
    prompt: () => void;
  };
};

function getGoogleAccounts(): GoogleAccounts | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).google?.accounts;
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
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleGoogleResponse = useCallback(async (response: { credential: string }) => {
    setError('');
    setLoading(true);
    try {
      await api.exchangeGoogleToken(response.credential);
      onLoginSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed.';
      setError(message);
      setShowEmailForm(true);
    } finally {
      setLoading(false);
    }
  }, [onLoginSuccess]);

  // Load Google Identity Services script and render button
  useEffect(() => {
    if (!isOpen) return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setShowEmailForm(true);
      return;
    }

    const initGoogle = () => {
      if (!getGoogleAccounts()?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleResponse,
        auto_select: true,
      });

      const btnContainer = document.getElementById('google-signin-btn');
      if (btnContainer) {
        window.google.accounts.id.renderButton(btnContainer, {
          theme: 'filled_black',
          size: 'large',
          width: '100%',
          text: 'continue_with',
          shape: 'rectangular',
        });
      }
    };

    // Load the GSI script if not already present
    if (getGoogleAccounts()?.id) {
      initGoogle();
    } else {
      const existing = document.getElementById('google-gsi-script');
      if (!existing) {
        const script = document.createElement('script');
        script.id = 'google-gsi-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initGoogle;
        document.head.appendChild(script);
      }
    }
  }, [isOpen, handleGoogleResponse]);

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
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
      const message = err instanceof Error ? err.message : 'Login failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
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

        <div className="px-6 pb-6 space-y-4">
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center text-gray-400 text-sm py-2">
              Signing in...
            </div>
          )}

          {/* Google Sign-In button */}
          <div className="flex justify-center">
            <div id="google-signin-btn" />
          </div>

          {/* Divider */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-gray-800 text-gray-500">or</span>
            </div>
          </div>

          {/* Email/password toggle */}
          {!showEmailForm ? (
            <button
              type="button"
              onClick={() => setShowEmailForm(true)}
              className="w-full py-2.5 bg-gray-700 hover:bg-gray-600
                         text-gray-300 font-medium rounded-lg text-sm transition-colors
                         border border-gray-600"
            >
              Sign in with email
            </button>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg
                             text-white placeholder-gray-500 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Email"
                />
              </div>
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg
                             text-white placeholder-gray-500 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600
                           text-white font-medium rounded-lg text-sm transition-colors"
              >
                Sign In
              </button>
            </form>
          )}

          {/* Demo Mode */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-gray-500 hover:text-gray-300 text-xs transition-colors"
          >
            Continue in Demo Mode
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
