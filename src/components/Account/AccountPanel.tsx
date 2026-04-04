/**
 * AccountPanel — side panel / modal showing user account, subscription, and usage.
 */

import React, { useState, useEffect } from 'react';
import { api, type SubscriptionInfo } from '../../services/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface AccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: { email: string; full_name?: string; username: string } | null;
  onShowPricing: () => void;
  onSignOut: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-600',
  trialing: 'bg-indigo-600',
  past_due: 'bg-yellow-600',
  canceled: 'bg-red-600',
  incomplete: 'bg-gray-600',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export const AccountPanel: React.FC<AccountPanelProps> = ({
  isOpen,
  onClose,
  user,
  onShowPricing,
  onSignOut,
}) => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loadingSub, setLoadingSub] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // Fetch subscription on mount
  useEffect(() => {
    if (!isOpen || !user) return;
    setLoadingSub(true);
    api.getSubscription()
      .then(setSubscription)
      .finally(() => setLoadingSub(false));
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { url } = await api.createPortalSession();
      window.location.href = url;
    } catch {
      // Fallback — if no subscription yet, show pricing
      onShowPricing();
    } finally {
      setPortalLoading(false);
    }
  };

  const initials = user
    ? (user.full_name || user.username || user.email)
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60]"
        onClick={onClose}
        style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-[60] flex flex-col overflow-y-auto"
        style={{
          width: 'min(380px, 90vw)',
          background: '#111827',
          borderLeft: '1px solid rgba(75, 85, 99, 0.5)',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
          <h2 className="text-white font-semibold text-base">Account</h2>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center
                       text-gray-400 hover:text-white transition-colors text-lg"
            aria-label="Close account panel"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 px-5 py-5 space-y-6">
          {/* ── Profile ────────────────────────────────────────────── */}
          <section>
            <h3 className="text-gray-400 text-[10px] uppercase tracking-widest font-semibold mb-3">Profile</h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-white font-medium text-sm truncate">
                  {user?.full_name || user?.username || 'User'}
                </div>
                <div className="text-gray-400 text-xs truncate">{user?.email || ''}</div>
              </div>
            </div>
          </section>

          {/* ── Subscription ───────────────────────────────────────── */}
          <section>
            <h3 className="text-gray-400 text-[10px] uppercase tracking-widest font-semibold mb-3">Subscription</h3>

            {loadingSub ? (
              <div className="text-gray-500 text-sm">Loading...</div>
            ) : subscription ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm capitalize">{subscription.tier} Plan</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full text-white ${STATUS_COLORS[subscription.status] || 'bg-gray-600'}`}>
                    {subscription.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs">Renews</div>
                    <div className="text-gray-300">{formatDate(subscription.current_period_end)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Seats</div>
                    <div className="text-gray-300">{subscription.seats}</div>
                  </div>
                </div>

                {subscription.cancel_at_period_end && (
                  <div className="text-yellow-400 text-xs">
                    Cancels at end of billing period
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    className="flex-1 py-2 px-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50
                               text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {portalLoading ? 'Opening...' : 'Manage Subscription'}
                  </button>
                  <button
                    onClick={() => { onClose(); onShowPricing(); }}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500
                               text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Upgrade
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-gray-400 text-sm">No active subscription</div>
                <button
                  onClick={() => { onClose(); onShowPricing(); }}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500
                             text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  View Plans
                </button>
              </div>
            )}
          </section>

          {/* ── Usage ──────────────────────────────────────────────── */}
          <section>
            <h3 className="text-gray-400 text-[10px] uppercase tracking-widest font-semibold mb-3">Usage</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-500 text-xs mb-1">Scans this month</div>
                <div className="text-white text-lg font-semibold">--</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-500 text-xs mb-1">Storage used</div>
                <div className="text-white text-lg font-semibold">--</div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer / Sign Out */}
        <div className="px-5 py-4 border-t border-gray-700 shrink-0">
          <button
            onClick={() => { onSignOut(); onClose(); }}
            className="w-full py-2.5 px-4 border border-red-700 hover:bg-red-900/30
                       text-red-400 text-sm font-medium rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
};
