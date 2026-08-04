import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email });
      setResetCode(res.data.reset_code);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email,
        reset_code: enteredCode,
        new_password: newPassword,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-lingo-bg">
      <div className="max-w-md w-full bg-white rounded-2xl border-2 border-lingo-border p-6 sm:p-8 shadow-lingo-sm mx-4">
        <h1 className="text-3xl font-extrabold text-center text-lingo-green mb-2">IBPS Coaching</h1>
        <h2 className="text-lg text-center mb-6 text-gray-600 font-bold">Reset Password</h2>

        {error && (
          <div className="bg-lingo-red/10 border-2 border-lingo-red text-lingo-red px-4 py-3 rounded-xl mb-4 font-bold">
            {error}
          </div>
        )}

        {done ? (
          <div className="space-y-4 text-center">
            <div className="bg-lingo-green/10 border-2 border-lingo-green text-lingo-green px-4 py-3 rounded-xl font-bold">
              Password updated successfully!
            </div>
            <p className="text-gray-600 font-semibold">You can now log in with your new password.</p>
            <Link to="/login" className="block w-full lingo-btn lingo-btn-green">
              Go to Login
            </Link>
          </div>
        ) : step === 1 ? (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <p className="text-gray-600 font-semibold text-sm">
              Enter your account email and we'll give you a one-time reset code (valid for 15 minutes).
            </p>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full px-4 py-3 border-2 border-lingo-border rounded-xl focus:outline-none focus:ring-2 focus:ring-lingo-blue focus:border-lingo-blue bg-white font-semibold"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="w-full lingo-btn lingo-btn-green">
              {loading ? 'Sending...' : 'Get Reset Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="bg-lingo-blue/10 border-2 border-lingo-blue text-lingo-blue px-4 py-3 rounded-xl font-bold text-center">
              Your reset code: {resetCode}
            </div>
            <p className="text-gray-600 font-semibold text-sm">
              Enter the code above along with a new password to finish resetting your password.
            </p>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Reset Code</label>
              <input
                type="text"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value)}
                autoComplete="off"
                className="w-full px-4 py-3 border-2 border-lingo-border rounded-xl focus:outline-none focus:ring-2 focus:ring-lingo-blue focus:border-lingo-blue bg-white font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-4 py-3 border-2 border-lingo-border rounded-xl focus:outline-none focus:ring-2 focus:ring-lingo-blue focus:border-lingo-blue bg-white font-semibold"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-4 py-3 border-2 border-lingo-border rounded-xl focus:outline-none focus:ring-2 focus:ring-lingo-blue focus:border-lingo-blue bg-white font-semibold"
                required
                minLength={6}
              />
            </div>
            <button type="submit" disabled={loading} className="w-full lingo-btn lingo-btn-green">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <p className="text-center mt-4 text-gray-600 font-semibold">
          Remembered it?{' '}
          <Link to="/login" className="text-lingo-blue font-extrabold hover:underline">
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
