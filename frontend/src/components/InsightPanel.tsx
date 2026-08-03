import React from 'react';
import { Sparkles, Target, Clock, AlertTriangle, TrendingUp, Award, Brain } from 'lucide-react';
import { Insight } from '../utils/insightEngine';

const ICONS = {
  sparkles: Sparkles,
  target: Target,
  clock: Clock,
  alert: AlertTriangle,
  trending: TrendingUp,
  award: Award,
  brain: Brain,
};

const TONES = {
  positive: { iconBg: 'bg-lingo-green/15', iconText: 'text-lingo-green-dark', accent: 'border-l-lingo-green' },
  warning: { iconBg: 'bg-lingo-red/15', iconText: 'text-lingo-red', accent: 'border-l-lingo-red' },
  info: { iconBg: 'bg-lingo-blue/15', iconText: 'text-lingo-blue-dark', accent: 'border-l-lingo-blue' },
};

const InsightPanel: React.FC<{ insights: Insight[]; title?: string }> = ({ insights, title = 'AI Insights' }) => {
  if (insights.length === 0) return null;

  return (
    <div>
      <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-lingo-purple-dark" />
        {title}
        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-lingo-purple/15 text-lingo-purple-dark font-bold">
          Instant
        </span>
      </h2>
      <div className="space-y-2">
        {insights.map(ins => {
          const Icon = ICONS[ins.icon];
          const t = TONES[ins.tone];
          return (
            <div key={ins.id} className={`lingo-card p-4 border-l-4 ${t.accent}`}>
              <div className="flex items-start gap-3">
                <span className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-xl ${t.iconBg} ${t.iconText}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900">{ins.title}</p>
                  <p className="text-sm text-gray-600 font-medium mt-0.5">{ins.message}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InsightPanel;
