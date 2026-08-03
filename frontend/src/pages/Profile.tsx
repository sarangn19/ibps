import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, GraduationCap, Clock, Calendar, Gift, Copy, Check } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import MobileNav from '../components/MobileNav';

const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const referralLink = user?.referral_code
    ? `${window.location.origin}/register?ref=${user.referral_code}`
    : null;

  const copyReferral = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      /* clipboard unavailable */
    }
  };

  const rows = [
    { icon: GraduationCap, label: 'Exam Goal', value: user?.exam_goal || 'Not set' },
    { icon: Calendar, label: 'Target Year', value: user?.target_year ? String(user.target_year) : 'Not set' },
    { icon: User, label: 'Prep Level', value: user?.prep_level ? user.prep_level[0].toUpperCase() + user.prep_level.slice(1) : 'Not set' },
    { icon: Clock, label: 'Daily Study Time', value: user?.daily_study_minutes ? `${user.daily_study_minutes} min/day` : 'Not set' }
  ];

  return (
    <div className="min-h-screen bg-lingo-bg">
      <PageHeader title="Profile" onBack={() => navigate('/dashboard')} />

      <div className="max-w-lg mx-auto px-4 pt-6 pb-nav">
        {/* Header card */}
        <div className="lingo-card p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-lingo-green flex items-center justify-center border-b-4 border-lingo-green-dark">
              <span className="text-2xl font-extrabold text-white">{user?.name?.[0]?.toUpperCase() || 'S'}</span>
            </div>
            <div>
              <p className="text-lg font-extrabold text-gray-900">{user?.name}</p>
              <p className="text-gray-600 text-sm font-semibold">{user?.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-lingo-green/15 text-lingo-green-dark rounded-xl text-xs font-bold capitalize">
                {user?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Referral */}
        {user?.referral_code && (
          <div className="lingo-card p-5 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lingo-yellow/25 text-lingo-yellow-dark">
                <Gift className="h-4 w-4" />
              </span>
              <h2 className="font-extrabold text-gray-900">Refer a friend</h2>
            </div>
            <p className="text-xs text-gray-500 font-semibold mb-3">
              Share your code — friends get started, and you get credited for every user you bring.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center justify-between gap-2 border-2 border-lingo-border rounded-xl px-4 py-3">
                <span className="text-lg font-extrabold tracking-widest text-lingo-green-dark">{user.referral_code}</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase">your code</span>
              </div>
              <button
                onClick={copyReferral}
                className="touch-target flex items-center gap-1.5 px-4 py-3 rounded-xl bg-lingo-blue text-white text-sm font-extrabold border-b-4 border-lingo-blue-dark hover:bg-lingo-blue-dark"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-400 font-medium mt-2 break-all">{referralLink}</p>
          </div>
        )}

        {/* Details */}
        <div className="lingo-card overflow-hidden">
          <div className="px-5 py-4 border-b-2 border-lingo-border">
            <h2 className="font-extrabold text-gray-900">Preparation Details</h2>
          </div>
          <div className="divide-y divide-lingo-border">
            {rows.map(row => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-center gap-4 px-5 py-4">
                  <Icon className="h-5 w-5 text-lingo-green shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-bold">{row.label}</p>
                    <p className="text-sm font-bold text-gray-900">{row.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings */}
        <div className="mt-6 lingo-card overflow-hidden divide-y divide-lingo-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between px-5 py-4 touch-target text-left hover:bg-lingo-bg"
          >
            <span className="text-sm font-extrabold text-lingo-red">Logout</span>
          </button>
        </div>
      </div>

      <MobileNav />
    </div>
  );
};

export default Profile;
