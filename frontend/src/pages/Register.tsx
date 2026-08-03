import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';

const Register: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(searchParams.get('ref') || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(name, email, password, referralCode.trim() || undefined);
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-lingo-bg">
      <div className="max-w-md w-full bg-white rounded-2xl border-2 border-lingo-border p-6 sm:p-8 shadow-lingo-sm mx-4">
        <h1 className="text-3xl font-extrabold text-center text-lingo-green mb-2">IBPS Coaching</h1>
        <h2 className="text-lg text-center mb-6 text-gray-600 font-bold">Student Registration</h2>

        {error && (
          <div className="bg-lingo-red/10 border-2 border-lingo-red text-lingo-red px-4 py-3 rounded-xl mb-4 font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full px-4 py-3 border-2 border-lingo-border rounded-xl focus:outline-none focus:ring-2 focus:ring-lingo-blue focus:border-lingo-blue bg-white font-semibold"
              required
            />
          </div>

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

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full px-4 py-3 border-2 border-lingo-border rounded-xl focus:outline-none focus:ring-2 focus:ring-lingo-blue focus:border-lingo-blue bg-white font-semibold"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Referral Code (optional)</label>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="e.g. ABC123"
              autoComplete="off"
              className="w-full px-4 py-3 border-2 border-lingo-border rounded-xl focus:outline-none focus:ring-2 focus:ring-lingo-blue focus:border-lingo-blue bg-white font-semibold uppercase"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full lingo-btn lingo-btn-green"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className="text-center mt-4 text-gray-600 font-semibold">
          Already have an account?{' '}
          <Link to="/login" className="text-lingo-blue font-extrabold hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
