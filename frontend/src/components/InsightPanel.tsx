import React, { useState } from 'react';
import { Sparkles, Target, Clock, AlertTriangle, TrendingUp, Award, Brain, ChevronDown, ChevronUp } from 'lucide-react';
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

const InsightPanel: React.FC<{ insights: Insight[]; title?: string; maxVisible?: number }> = ({
  insights,
  title = 'AI Insights',
  maxVisible,
}) => {
  const [expanded, setExpanded] = useState(false);
  if (insights.length === 0) return null;

  const visible = maxVisible && !expanded ? insights.slice(0, maxVisible) : insights;

  return (
    <div>
      <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-lingo-blue-dark" />
        {title}
        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-lingo-blue/15 text-lingo-blue-dark font-bold">
          Instant
        </span>
      </h2>
      <div className="space-y-2">
        {visible.map(ins => {
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
      {maxVisible && insights.length > maxVisible && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full mt-2 py-2.5 rounded-xl text-sm font-bold text-lingo-blue hover:bg-lingo-blue/10 touch-target flex items-center justify-center gap-1"
        >
          {expanded ? (
            <>Show less <ChevronUp className="h-4 w-4" /></>
          ) : (
            <>View all {insights.length} insights <ChevronDown className="h-4 w-4" /></>
          )}
        </button>
      )}
    </div>
  );
};

export default InsightPanel;
