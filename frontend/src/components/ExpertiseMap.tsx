import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { ChevronDown, ChevronRight, Brain, AlertTriangle, CheckCircle, HelpCircle, TrendingUp, Flame, Clock } from 'lucide-react';

interface ErrorBreakdown {
  concept_gap?: number;
  silly_mistake?: number;
  guessed?: number;
  time_out?: number;
}

interface SubtopicNode {
  subtopic: string;
  mastery_score: number;
  raw_score: number;
  attempt_count: number;
  accuracy_rolling: number;
  classification: string;
  last_result: number | null;
  current_streak: number;
  peak_score: number;
  difficulty_accuracy: Record<string, { c: number; a: number }>;
  error_type_breakdown: ErrorBreakdown;
  days_since_last_attempt: number | null;
}

interface TopicNode {
  topic: string;
  subtopics: SubtopicNode[];
}

interface SubjectNode {
  subject: string;
  topics: TopicNode[];
}

interface HistoryPoint {
  mastery_score: number;
  raw_score: number;
  attempt_count: number;
  timestamp: string;
}

const classificationColor = (cls: string) => {
  switch (cls) {
    case 'strong': return 'bg-green-100 text-green-800 border-green-300';
    case 'developing': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'weak': return 'bg-red-100 text-red-800 border-red-300';
    case 'not_attempted': return 'bg-gray-100 text-gray-500 border-gray-200';
    default: return 'bg-gray-50 text-gray-400 border-gray-100';
  }
};

const classificationIcon = (cls: string) => {
  switch (cls) {
    case 'strong': return <CheckCircle className="h-3.5 w-3.5" />;
    case 'developing': return <Brain className="h-3.5 w-3.5" />;
    case 'weak': return <AlertTriangle className="h-3.5 w-3.5" />;
    default: return <HelpCircle className="h-3.5 w-3.5" />;
  }
};

const masteryBar = (score: number) => {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.max(2, score)}%` }}></div>
    </div>
  );
};

const accuracyPct = (b?: { c: number; a: number }) => (b && b.a > 0 ? Math.round((b.c / b.a) * 100) : null);

const diffBar = (label: string, pct: number | null) => (
  <span className="flex items-center gap-1">
    <span className="text-gray-400">{label}</span>
    <span className={`text-xs font-semibold ${pct === null ? 'text-gray-300' : pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
      {pct === null ? '—' : `${pct}%`}
    </span>
  </span>
);

const Sparkline: React.FC<{ points: HistoryPoint[] }> = ({ points }) => {
  if (points.length < 2) {
    return <p className="text-xs text-gray-400">Not enough history yet — keep practicing.</p>;
  }
  const scores = points.map(p => p.mastery_score);
  const min = Math.min(...scores) - 5;
  const max = Math.max(...scores) + 5;
  const range = Math.max(max - min, 1);
  const w = 280, h = 40;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p.mastery_score - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = points[points.length - 1];
  const lastIdx = points.length - 1;
  const lx = (lastIdx / (points.length - 1)) * w;
  const ly = h - ((last.mastery_score - min) / range) * h;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10">
        <polyline points={coords.join(' ')} fill="none" stroke="#2563eb" strokeWidth="2" />
        <circle cx={lx} cy={ly} r="3" fill="#2563eb" />
      </svg>
      <p className="text-xs text-gray-500 mt-1">
        Now {last.mastery_score.toFixed(0)}% · {points.length} snapshot{points.length === 1 ? '' : 's'} · last {new Date(last.timestamp.replace(' ', 'T')).toLocaleDateString()}
      </p>
    </div>
  );
};

const ExpertiseMap: React.FC = () => {
  const navigate = useNavigate();
  const [mapData, setMapData] = useState<SubjectNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [trends, setTrends] = useState<Record<string, HistoryPoint[]>>({});
  const [trendLoading, setTrendLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get('/mastery/my-map')
      .then(res => setMapData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const loadTrend = async (subject: string, topic: string, subtopic: string) => {
    const key = `${subject}|${topic}|${subtopic}`;
    if (trends[key] || trendLoading[key]) return;
    setTrendLoading(prev => ({ ...prev, [key]: true }));
    try {
      const params = new URLSearchParams({ subject, topic, subtopic });
      const res = await api.get(`/mastery/history?${params.toString()}`);
      setTrends(prev => ({ ...prev, [key]: res.data }));
    } catch (e) { /* ignore */ } finally {
      setTrendLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (mapData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Brain className="mx-auto h-8 w-8 mb-2" />
        <p className="text-sm">No mastery data yet. Start practicing to build your expertise map.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mapData.map(subject => (
        <div key={subject.subject} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => toggle(subject.subject)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              {expanded[subject.subject] ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
              <span className="font-medium text-gray-900">{subject.subject}</span>
              <span className="text-xs text-gray-500">{subject.topics.length} topics</span>
            </div>
          </button>

          {expanded[subject.subject] && (
            <div className="px-3 pb-3 space-y-2">
              {subject.topics.map(topic => (
                <div key={topic.topic} className="border border-gray-100 rounded-lg">
                  <button
                    onClick={() => toggle(`${subject.subject}|${topic.topic}`)}
                    className="w-full flex items-center justify-between p-2 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {expanded[`${subject.subject}|${topic.topic}`] ? <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" /> : <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />}
                      <span className="text-sm text-gray-700 truncate">{topic.topic}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-500">{topic.subtopics.length} subtopics</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${classificationColor(overallClassification(topic.subtopics))}`}>
                        {overallClassification(topic.subtopics)}
                      </span>
                    </div>
                  </button>

                  {expanded[`${subject.subject}|${topic.topic}`] && (
                    <div className="px-2 pb-2 space-y-1">
                      {topic.subtopics.map(st => {
                        const diff = st.difficulty_accuracy || {};
                        const trendKey = `${subject.subject}|${topic.topic}|${st.subtopic}`;
                        return (
                          <div key={st.subtopic} className="p-2 rounded-lg hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5 text-xs min-w-[80px]">
                                <span className={classificationColor(st.classification).split(' ')[0] === 'bg-green-100' ? 'text-green-600' : classificationColor(st.classification).split(' ')[0] === 'bg-yellow-100' ? 'text-yellow-600' : classificationColor(st.classification).split(' ')[0] === 'bg-red-100' ? 'text-red-600' : 'text-gray-400'}>
                                  {classificationIcon(st.classification)}
                                </span>
                                <span className="text-gray-700 truncate max-w-[110px]">{st.subtopic}</span>
                              </div>
                              <div className="flex-1 min-w-[50px]">{masteryBar(st.mastery_score)}</div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 min-w-[96px] justify-end">
                                <span>{st.mastery_score.toFixed(0)}%</span>
                                <span>{st.attempt_count}q</span>
                                {st.classification !== 'not_attempted' && (
                                  <button
                                    onClick={() => navigate(`/practice/start?subject=${encodeURIComponent(subject.subject)}&topic=${encodeURIComponent(topic.topic)}&subtopic=${encodeURIComponent(st.subtopic)}`)}
                                    className="text-blue-600 hover:text-blue-700 font-medium px-2 py-1 touch-target flex items-center"
                                  >
                                    Practice
                                  </button>
                                )}
                              </div>
                            </div>

                            {(st.current_streak >= 3 || st.days_since_last_attempt !== null || Object.keys(diff).length > 0) && (
                              <div className="flex items-center gap-3 mt-1.5 pl-[80px] flex-wrap">
                                {st.current_streak >= 3 && (
                                  <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 rounded-full px-2 py-0.5">
                                    <Flame className="h-3 w-3" /> {st.current_streak} in a row
                                  </span>
                                )}
                                {st.days_since_last_attempt !== null && st.days_since_last_attempt >= 7 && (
                                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                                    <Clock className="h-3 w-3" /> {st.days_since_last_attempt}d stale
                                  </span>
                                )}
                                <div className="flex gap-3 text-xs">
                                  {diffBar('E', accuracyPct(diff.easy))}
                                  {diffBar('M', accuracyPct(diff.medium))}
                                  {diffBar('H', accuracyPct(diff.hard))}
                                </div>
                                {(st.error_type_breakdown.concept_gap || 0) > 0 && (
                                  <span className="text-xs text-gray-500">{st.error_type_breakdown.concept_gap} concept errors</span>
                                )}
                                <button
                                  onClick={() => loadTrend(subject.subject, topic.topic, st.subtopic)}
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                                >
                                  <TrendingUp className="h-3 w-3" /> Trend
                                </button>
                              </div>
                            )}

                            {trends[trendKey] && (
                              <div className="mt-2 pl-[80px]">
                                <Sparkline points={trends[trendKey]} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

function overallClassification(subtopics: SubtopicNode[]): string {
  const counts = { strong: 0, developing: 0, weak: 0, not_attempted: 0 };
  for (const st of subtopics) counts[st.classification as keyof typeof counts]++;
  if (counts.weak > 0) return 'weak';
  if (counts.developing > 0) return 'developing';
  if (counts.strong > 0) return 'strong';
  return 'not_attempted';
}

export default ExpertiseMap;
