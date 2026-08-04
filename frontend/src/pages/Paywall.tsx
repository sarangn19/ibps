import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Check, Sparkles, CalendarClock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const Paywall: React.FC = () => {
  const { user, access, refreshAccess, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const subscribe = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/subscription/subscribe');
      await refreshAccess();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!user || !access) return null;

  const granted = access.plan === 'granted_free';
  const monthly = access.plan === 'monthly';
  const staff = access.plan === 'staff';
  const trial = access.plan === 'trial';
  const locked = !access.allowed;

  const price = access.amount_per_month || 129;
  const endsLabel = access.ends_at
    ? new Date(access.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Lifetime';
  const trialEndLabel = access.trial_ends_at
    ? new Date(access.trial_ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div className="min-h-screen bg-lingo-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="lingo-card overflow-hidden">
          <div className="p-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-lingo-blue/15 mb-4">
              <Lock className="h-10 w-10 text-lingo-blue-dark" />
            </div>

            {locked && (
              <>
                <h1 className="text-2xl font-extrabold text-gray-900 leading-snug">Your free trial has ended</h1>
                <p className="mt-2 text-sm text-gray-600 font-medium">
                  Keep practicing with full access to tests, mocks, topic practice and Current Affairs.
                </p>
              </>
            )}
            {granted && (
              <>
                <h1 className="text-2xl font-extrabold text-lingo-green-dark leading-snug">You have free access</h1>
                <p className="mt-2 text-sm text-gray-600 font-medium">
                  {access.granted_by
                    ? `Granted by your coach${access.ends_at ? ` — valid till ${endsLabel}` : ' — lifetime'}.`
                    : `Free subscription${access.ends_at ? ` valid till ${endsLabel}` : ' — lifetime'}.`}
                </p>
              </>
            )}
            {monthly && (
              <>
                <h1 className="text-2xl font-extrabold text-lingo-green-dark leading-snug">Your subscription is active</h1>
                <p className="mt-2 text-sm text-gray-600 font-medium">
                  Renews {endsLabel}. Thanks for being a subscriber!
                </p>
              </>
            )}
            {staff && (
              <>
                <h1 className="text-2xl font-extrabold text-lingo-green-dark leading-snug">Staff access</h1>
                <p className="mt-2 text-sm text-gray-600 font-medium">Admins and coaches always have free access.</p>
              </>
            )}
            {trial && (
              <>
                <h1 className="text-2xl font-extrabold text-gray-900 leading-snug">Your free trial is on</h1>
                <p className="mt-2 text-sm text-gray-600 font-medium">
                  {access.trial_days_left} day{access.trial_days_left === 1 ? '' : 's'} left
                  {trialEndLabel ? ` (ends ${trialEndLabel})` : ''}. Subscribe now to keep going.
                </p>
              </>
            )}
          </div>

          <div className="px-6 pb-6">
            <div className="rounded-2xl border-2 border-lingo-border bg-lingo-bg p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-lingo-blue-dark" />
                <span className="text-sm font-extrabold text-gray-900">IBPS Coaching Pro</span>
              </div>
              <ul className="space-y-2">
                {['All full mocks & sectional tests', 'Unlimited topic-wise practice', 'Daily Current Affairs & quizzes', 'Personalised weak-area tracking'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700 font-medium">
                    <Check className="h-4 w-4 text-lingo-green shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-4 border-t border-lingo-border">
                <p className="text-2xl font-extrabold text-gray-900">
                  ₹{price}
                  <span className="text-sm font-bold text-gray-500"> / month</span>
                </p>
                <p className="text-xs text-gray-500 font-semibold mt-1">No long-term commitment. Cancel anytime.</p>
              </div>
            </div>

            {locked && (
              <button
                onClick={subscribe}
                disabled={busy}
                className="w-full lingo-btn lingo-btn-green"
              >
                {busy ? 'Starting subscription...' : `Subscribe — ₹${price}/month`}
              </button>
            )}
            {!locked && (
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full lingo-btn lingo-btn-green"
              >
                Continue to Dashboard
              </button>
            )}
            {error && <p className="mt-3 text-sm text-lingo-red font-semibold text-center">{error}</p>}

            <div className="mt-5 text-center">
              {user.role === 'student' && access.granted_by && !locked && (
                <p className="text-xs text-gray-400 font-semibold">Subscription managed by your coach</p>
              )}
              <button onClick={logout} className="block mx-auto mt-2 text-xs font-bold text-lingo-red hover:text-lingo-red-dark touch-target">
                Logout
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 font-semibold mt-4 flex items-center justify-center gap-1">
          <CalendarClock className="h-3.5 w-3.5" />
          New users get a 14-day free trial
        </p>
      </div>
    </div>
  );
};

export default Paywall;
