import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Target, User, Newspaper } from 'lucide-react';

const TABS = [
  { label: 'Home', icon: Home, path: '/dashboard' },
  { label: 'Practice', icon: Target, path: '/practice/start' },
  { label: 'CA', icon: Newspaper, path: '/current-affairs' },
  { label: 'Profile', icon: User, path: '/profile' }
];

const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (tab: { label: string; icon: typeof Home; path: string }) => {
    if (tab.path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname.startsWith('/results/');
    }
    if (tab.path === '/practice/start') {
      return location.pathname.startsWith('/practice/') || location.pathname.startsWith('/test/');
    }
    return location.pathname.startsWith(tab.path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-lingo-border pb-safe">
      <div className="max-w-lg mx-auto grid grid-cols-4">
        {TABS.map(tab => {
          const active = isActive(tab);
          const Icon = tab.icon;
          return (
            <button
              key={tab.label}
              onClick={() => {
                if (tab.path === '/dashboard') navigate('/dashboard');
                else navigate(tab.path);
              }}
              className={`touch-target flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                active ? 'text-lingo-green' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className={`flex items-center justify-center rounded-2xl transition-colors ${
                active ? 'bg-lingo-green/15' : ''
              }`}>
                <Icon className={`h-6 w-6 ${active ? 'fill-current' : ''}`} />
              </span>
              <span className={`text-[10px] font-bold ${active ? '' : ''}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
