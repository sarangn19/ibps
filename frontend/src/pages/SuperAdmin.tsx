import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import PageHeader from '../components/PageHeader';
import { Shield, UserPlus, Trash2 } from 'lucide-react';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
  total_attempts: number;
}

const SuperAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const load = () => {
    api.get('/superadmin/admins')
      .then(r => setAdmins(r.data))
      .catch(() => setMessage({ type: 'error', text: 'Failed to load admins' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage(null);
    try {
      await api.post('/superadmin/admins', { name, email, password });
      setMessage({ type: 'success', text: 'Admin created successfully' });
      setName(''); setEmail(''); setPassword('');
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create admin' });
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = async (id: number, adminName: string) => {
    if (!window.confirm(`Remove ${adminName} from admin role? This will demote them to student.`)) return;
    setMessage(null);
    try {
      await api.delete(`/superadmin/admins/${id}`);
      setMessage({ type: 'success', text: `${adminName} has been demoted to student` });
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to remove admin' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Admin Management"
        wide
        onBack={() => navigate('/admin')}
        right={
          <span className="flex items-center gap-1.5 text-sm text-lingo-blue-dark font-medium">
            <Shield className="h-4 w-4" /> Superadmin
          </span>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create admin form */}
        <div className="bg-white rounded-lg shadow-sm border p-5 h-fit">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
            <UserPlus className="h-4 w-4 text-lingo-blue-dark" />
            Add New Admin
          </h2>
          <p className="text-sm text-gray-500 mb-4">Admins manage students, questions, tests and analytics.</p>

          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lingo-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lingo-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lingo-blue"
              />
            </div>
            <button
              type="submit" disabled={creating}
              className="w-full bg-lingo-blue text-white py-2 px-4 rounded-md hover:bg-lingo-blue-dark disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Admin'}
            </button>
          </form>

          {message && (
            <p className={`mt-3 text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{message.text}</p>
          )}
        </div>

        {/* Admin list */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Admins & Superadmins</h2>
          </div>
          {loading ? (
            <div className="p-6 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lingo-blue"></div>
            </div>
          ) : admins.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No admins yet</p>
          ) : (
            <div className="divide-y">
              {admins.map(a => (
                <div key={a.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                      {a.name}
                      <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${
                        a.role === 'superadmin' ? 'bg-lingo-blue/15 text-lingo-blue-dark' : 'bg-gray-100 text-gray-700'
                      }`}>{a.role}</span>
                    </p>
                    <p className="text-xs text-gray-500 truncate">{a.email}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      Created {new Date(a.created_at).toLocaleDateString()}
                    </span>
                    {a.role !== 'superadmin' && (
                      <button
                        onClick={() => handleRemove(a.id, a.name)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-red-200 text-red-600 rounded-md hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdmin;
