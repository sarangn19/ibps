import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' || user.role === 'superadmin' ? '/admin' : '/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-lingo-bg">
      <div className="max-w-md w-full bg-white rounded-2xl border-2 border-lingo-border p-6 sm:p-8 shadow-lingo-sm mx-4">
        <h1 className="text-3xl font-extrabold text-center text-lingo-green mb-2">IBPS Coaching</h1>
        <h2 className="text-lg text-center mb-6 text-gray-600 font-bold">Student Login</h2>

        {error && (
          <div className="bg-lingo-red/10 border-2 border-lingo-red text-lingo-red px-4 py-3 rounded-xl mb-4 font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
              autoComplete="current-password"
              className="w-full px-4 py-3 border-2 border-lingo-border rounded-xl focus:outline-none focus:ring-2 focus:ring-lingo-blue focus:border-lingo-blue bg-white font-semibold"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full lingo-btn lingo-btn-green"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="flex items-center justify-between mt-4 text-gray-600 font-semibold">
          <Link to="/forgot-password" className="text-lingo-blue font-extrabold hover:underline">
            Forgot password?
          </Link>
          <span>
            Don't have an account?{' '}
            <Link to="/register" className="text-lingo-blue font-extrabold hover:underline">
              Register
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
};

export default Login;
