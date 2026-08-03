import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  right?: React.ReactNode;
  wide?: boolean;
  showBack?: boolean;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, onBack, backLabel, right, wide, showBack = true }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <nav className="bg-white border-b-2 border-lingo-border sticky top-0 z-20">
      <div
        className={`${
          wide ? 'max-w-7xl px-4 sm:px-6 lg:px-8' : 'max-w-lg px-4'
        } mx-auto h-14 flex items-center justify-between gap-2`}
      >
        <div className="flex items-center gap-1 min-w-0">
          {showBack && (
            <button
              onClick={handleBack}
              className="touch-target flex items-center justify-center h-9 w-9 -ml-1 rounded-xl text-gray-600 hover:bg-lingo-bg shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex items-center gap-2">
            <h1 className="text-lg font-extrabold text-gray-900 truncate">{title}</h1>
            {backLabel && <span className="text-xs text-gray-400 hidden sm:inline">{backLabel}</span>}
          </div>
        </div>
        {right && (
          <div className="flex items-center gap-2 min-w-0 overflow-x-auto whitespace-nowrap no-scrollbar shrink-0">{right}</div>
        )}
      </div>
    </nav>
  );
};

export default PageHeader;
