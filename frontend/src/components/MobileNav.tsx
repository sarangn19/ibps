import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Target, ClipboardList, User } from 'lucide-react';

const TABS = [
  { label: 'Home', icon: Home, path: '/dashboard' },
  { label: 'Practice', icon: Target, path: '/practice/start' },
  { label: 'Tests', icon: ClipboardList, path: '/dashboard' },
  { label: 'Profile', icon: User, path: '/profile' }
];

const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 pb-safe">
      <div className="max-w-lg mx-auto grid grid-cols-4">
        {TABS.map(tab => {
          const active = tab.path === '/dashboard'
            ? (location.pathname === '/dashboard' || location.pathname === '/results/')
            : location.pathname.startsWith(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.label}
              onClick={() => {
                if (tab.path === '/dashboard') navigate('/dashboard');
                else navigate(tab.path);
              }}
              className={`touch-target flex flex-col items-center justify-center gap-0.5 py-2 ${
                active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
