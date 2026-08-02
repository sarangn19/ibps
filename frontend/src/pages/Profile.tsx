import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, GraduationCap, Clock, Calendar } from 'lucide-react';

const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const rows = [
    { icon: GraduationCap, label: 'Exam Goal', value: user?.exam_goal || 'Not set' },
    { icon: Calendar, label: 'Target Year', value: user?.target_year ? String(user.target_year) : 'Not set' },
    { icon: User, label: 'Prep Level', value: user?.prep_level ? user.prep_level[0].toUpperCase() + user.prep_level.slice(1) : 'Not set' },
    { icon: Clock, label: 'Daily Study Time', value: user?.daily_study_minutes ? `${user.daily_study_minutes} min/day` : 'Not set' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 h-14 flex items-center">
          <h1 className="text-lg font-bold text-gray-900">Profile</h1>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6 pb-nav">
        {/* Header card */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-md p-6 text-white mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-2xl font-bold">{user?.name?.[0]?.toUpperCase() || 'S'}</span>
            </div>
            <div>
              <p className="text-lg font-semibold">{user?.name}</p>
              <p className="text-blue-100 text-sm">{user?.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-white/20 rounded-full text-xs capitalize">
                {user?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Preparation Details</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {rows.map(row => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-center gap-4 px-5 py-4">
                  <Icon className="h-5 w-5 text-blue-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">{row.label}</p>
                    <p className="text-sm font-medium text-gray-900">{row.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
          <button className="w-full flex items-center justify-between px-5 py-4 touch-target text-left hover:bg-gray-50">
            <span className="text-sm font-medium text-gray-900">Settings</span>
          </button>
          <button className="w-full flex items-center justify-between px-5 py-4 touch-target text-left hover:bg-gray-50">
            <span className="text-sm font-medium text-gray-900">Help & Support</span>
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl font-medium touch-target hover:bg-red-100"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Profile;
