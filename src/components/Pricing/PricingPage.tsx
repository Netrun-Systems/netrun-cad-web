/**
 * PricingPage — modal overlay showing Survai Construction pricing tiers.
 * Calls Stripe checkout for trial starts; mailto for enterprise/team sales.
 */

import React, { useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { LoginModal } from '../Auth/LoginModal';

// ── Stripe Price IDs (LIVE) ─────────────────────────────────────────────────

const PRICES = {
  starter: { monthly: 'price_1TIZj1RliApyRm45AwC6BJF1', annual: 'price_1TIZj1RliApyRm45XhAhKHQe' },
  pro: { monthly: 'price_1TIZj1RliApyRm45ixGos4VG', annual: 'price_1TIZj2RliApyRm451vf5YCYk' },
  team: { monthly: 'price_1TIZj2RliApyRm45TXfDQNON', annual: 'price_1TIZj2RliApyRm45apdlqoll' },
  pilot: 'price_1TIZj3RliApyRm451ATDlm5H',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface PricingPageProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: string;
}

interface TierDef {
  key: string;
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  annualSavings: string;
  perSeat?: boolean;
  badge?: string;
  features: string[];
  cta: 'trial' | 'sales' | 'contact';
}

const TIERS: TierDef[] = [
  {
    key: 'starter',
    name: 'Starter',
    monthlyPrice: '$49',
    annualPrice: '$490',
    annualSavings: 'Save $98/yr',
    features: [
      '3D scan viewer',
      'Basic CAD (view, measure)',
      '5 scans/month',
      'DXF import, PDF export',
      '1 Google Drive project',
    ],
    cta: 'trial',
  },
  {
    key: 'pro',
    name: 'Pro',
    monthlyPrice: '$99',
    annualPrice: '$1,188',
    annualSavings: 'Save $0 — same rate',
    badge: 'MOST POPULAR',
    features: [
      'Everything in Starter',
      'Full CAD (layers, Apple Pencil, DXF export)',
      'Unlimited scans',
      'ML MEP detection',
      'Blueprint deviation comparison',
      'MEP route estimation',
      '5 Google Drive projects',
    ],
    cta: 'trial',
  },
  {
    key: 'team',
    name: 'Team',
    monthlyPrice: '$79',
    annualPrice: '$948',
    annualSavings: 'Save $0/seat — same rate',
    perSeat: true,
    badge: 'BEST VALUE',
    features: [
      'Everything in Pro',
      '5+ seats (team management)',
      'Unlimited Google Drive projects',
      'White-label reports',
      'Priority support (24h)',
    ],
    cta: 'sales',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 'Custom',
    annualPrice: 'Custom',
    annualSavings: '',
    features: [
      'Everything in Team',
      'API access',
      'Custom ML model training',
      'SSO / dedicated storage',
      'Dedicated CSM',
    ],
    cta: 'contact',
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export const PricingPage: React.FC<PricingPageProps> = ({ isOpen, onClose, currentTier }) => {
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pendingPriceId, setPendingPriceId] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const { isAuthenticated } = useAuth();

  if (!isOpen) return null;

  const startCheckout = async (priceId: string) => {
    setLoading('checkout');
    setError('');
    try {
      const { url } = await api.createCheckoutSession(priceId);
      window.location.href = url;
    } catch {
      setError('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleCheckout = async (tierKey: string) => {
    const prices = PRICES[tierKey as keyof typeof PRICES];
    if (!prices || typeof prices === 'string') return;
    const priceId = annual ? prices.annual : prices.monthly;

    if (!isAuthenticated) {
      setPendingPriceId(priceId);
      setShowLogin(true);
      return;
    }

    setLoading(tierKey);
    setError('');
    try {
      const { url } = await api.createCheckoutSession(priceId);
      window.location.href = url;
    } catch {
      setError('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    if (pendingPriceId) {
      startCheckout(pendingPriceId);
      setPendingPriceId(null);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60]"
        onClick={onClose}
        style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(6px)' }}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto py-8 px-4">
        <div
          className="relative w-full max-w-5xl rounded-xl border border-gray-700 shadow-2xl"
          style={{ background: '#111827' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center
                       text-gray-400 hover:text-white transition-colors text-xl z-10"
            aria-label="Close pricing"
          >
            &times;
          </button>

          {/* Header */}
          <div className="text-center pt-8 pb-6 px-4">
            <h2 className="text-2xl font-bold text-white mb-2">Survai Construction Plans</h2>
            <p className="text-gray-400 text-sm mb-6">
              From scan to blueprint — choose the plan that fits your team.
            </p>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-3 bg-gray-800 rounded-full px-4 py-2">
              <span className={`text-sm ${!annual ? 'text-white font-semibold' : 'text-gray-400'}`}>Monthly</span>
              <button
                onClick={() => setAnnual(!annual)}
                className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-indigo-600' : 'bg-gray-600'}`}
                aria-label="Toggle annual billing"
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform
                    ${annual ? 'translate-x-6' : 'translate-x-0.5'}`}
                />
              </button>
              <span className={`text-sm ${annual ? 'text-white font-semibold' : 'text-gray-400'}`}>Annual</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mb-4 px-4 py-2 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          {/* Pricing cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-6 pb-8">
            {TIERS.map((tier) => {
              const isCurrent = currentTier === tier.key;
              const isCustom = tier.key === 'enterprise';
              const price = annual ? tier.annualPrice : tier.monthlyPrice;
              const suffix = isCustom ? '' : annual ? '/yr' : '/mo';
              const perSeat = tier.perSeat && !isCustom ? '/seat' : '';

              return (
                <div
                  key={tier.key}
                  className={`relative flex flex-col rounded-xl border p-5
                    ${isCurrent
                      ? 'border-indigo-500 bg-indigo-950/30'
                      : tier.badge
                        ? 'border-indigo-600/50 bg-gray-800/60'
                        : 'border-gray-700 bg-gray-800/40'
                    }`}
                >
                  {/* Badge */}
                  {tier.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                      {tier.badge}
                    </div>
                  )}

                  {/* Current indicator */}
                  {isCurrent && (
                    <div className="absolute -top-3 right-3 px-3 py-0.5 bg-green-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                      Current
                    </div>
                  )}

                  <h3 className="text-lg font-semibold text-white mb-1">{tier.name}</h3>

                  <div className="mb-4">
                    <span className="text-3xl font-bold text-white">{price}</span>
                    {!isCustom && (
                      <span className="text-gray-400 text-sm">{perSeat}{suffix}</span>
                    )}
                    {annual && tier.annualSavings && !isCustom && (
                      <div className="text-indigo-400 text-xs mt-1">{tier.annualSavings}</div>
                    )}
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-indigo-400 mt-0.5 shrink-0">&#10003;</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {tier.cta === 'trial' && !isCurrent && (
                    <button
                      onClick={() => handleCheckout(tier.key)}
                      disabled={loading !== null}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                                 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      {loading === tier.key ? 'Redirecting...' : `Start ${tier.name} Trial`}
                    </button>
                  )}
                  {tier.cta === 'sales' && !isCurrent && (
                    <a
                      href="mailto:sales@netrunsystems.com?subject=Survai%20Team%20Plan"
                      className="block w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500
                                 text-white text-sm font-semibold rounded-lg transition-colors text-center"
                    >
                      Contact Sales
                    </a>
                  )}
                  {tier.cta === 'contact' && !isCurrent && (
                    <a
                      href="mailto:sales@netrunsystems.com?subject=Survai%20Enterprise"
                      className="block w-full py-2.5 px-4 border border-indigo-600 hover:bg-indigo-600/20
                                 text-indigo-400 hover:text-white text-sm font-semibold rounded-lg transition-colors text-center"
                    >
                      Contact Sales
                    </a>
                  )}
                  {isCurrent && (
                    <div className="w-full py-2.5 px-4 bg-gray-700 text-gray-400 text-sm font-semibold rounded-lg text-center">
                      Current Plan
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="text-center pb-4 text-gray-500 text-xs">
            All plans include a 14-day free trial. Cancel anytime.
          </div>
          <div className="text-center pb-6">
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
            >
              or continue in Demo Mode
            </button>
          </div>
        </div>
      </div>

      {/* Login modal for unauthenticated checkout */}
      <LoginModal
        isOpen={showLogin}
        onClose={() => { setShowLogin(false); setPendingPriceId(null); }}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
};
