import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import PageHeader from '../components/PageHeader';
import { Sparkles, Brain, Zap, Activity, Flame } from 'lucide-react';

interface Module {
  id: string;
  label: string;
}

const MODULES: Module[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'journey', label: 'Student Journey' },
  { id: 'learning', label: 'Learning Analytics' },
  { id: 'mock', label: 'Mock Test Analytics' },
  { id: 'heatmap', label: 'Topic Heatmap' },
  { id: 'dropoffs', label: 'Drop-offs' },
  { id: 'retention', label: 'Retention' },
  { id: 'personas', label: 'Personas' },
  { id: 'coach', label: 'AI Insights' },
];

const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <div className={`bg-white rounded-lg shadow-sm border p-4 ${className || ''}`}>
    {title && <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>}
    {children}
  </div>
);

const Stat: React.FC<{ label: string; value: React.ReactNode; sub?: string; color?: string }> = ({ label, value, sub, color }) => (
  <div className="bg-white rounded-lg shadow-sm border p-4">
    <p className="text-xs font-medium uppercase text-gray-500 mb-1">{label}</p>
    <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
  </div>
);

const Bar: React.FC<{ label: string; value: number; max?: number; suffix?: string; sub?: string }> = ({ label, value, max = 100, suffix = '%', sub }) => {
  const w = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-32 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
        <div className={`${color} h-3 rounded-full transition-all`} style={{ width: `${w}%` }}></div>
      </div>
      <span className="text-sm font-semibold text-gray-700 w-12 text-right shrink-0">{value}{suffix}</span>
      {sub && <span className="text-xs text-gray-400 w-20 text-right shrink-0">{sub}</span>}
    </div>
  );
};

const UxResearch: React.FC = () => {
  const navigate = useNavigate();
  const [module, setModule] = useState('dashboard');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get('/admin/research/dashboard')
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load research data'))
      .finally(() => setLoading(false));
  }, []);

  const renderModule = () => {
    if (!data) return null;
    const o = data.overall || {};

    switch (module) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Students" value={o.students || 0} />
              <Stat label="DAU" value={o.dau || 0} sub="active last 24h" color="text-blue-600" />
              <Stat label="WAU" value={o.wau || 0} sub="active last 7d" color="text-purple-600" />
              <Stat label="Premium" value={o.premium_students || 0} sub="paid subscribers" color="text-green-600" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Accuracy" value={`${data.accuracy?.accuracy || 0}%`} sub={`${data.accuracy?.attempted || 0} attempted`} />
              <Stat label="Avg session" value={`${data.learning?.avg_study_minutes || 0} min`} sub="per active day" />
              <Stat label="Questions/day" value={data.learning?.questions_per_active_day || 0} sub="per active day" />
              <Stat label="Consistency" value={<span className="flex items-center gap-1">{data.learning?.avg_consistency_days || 0}<Flame className="h-5 w-5 text-orange-500" /></span>} sub="avg day streak" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Stat label="Strong subject" value={data.learning?.strong_subject?.name || '—'} sub={data.learning?.strong_subject ? `${data.learning.strong_subject.accuracy}% accuracy` : undefined} color="text-green-600" />
              <Stat label="Weak subject" value={data.learning?.weak_subject?.name || '—'} sub={data.learning?.weak_subject ? `${data.learning.weak_subject.accuracy}% accuracy` : undefined} color="text-red-600" />
              <Stat label="Predicted score" value={`${data.learning?.predicted_score || 0}/100`} sub="based on accuracy" color="text-blue-600" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Stat label="Mock completion" value={`${data.mock?.mocks_completed_pct || 0}%`} sub={`${o.mocks_completed || 0}/${o.mocks_total || 0} finished`} />
              <Stat label="7-day retention" value={`${data.retention?.day7 || 0}%`} color="text-purple-600" />
              <Stat label="Mock avg score" value={data.mock?.avg_score || '—'} />
            </div>
            <Card title="Most searched" className="border-l-4 border-l-lingo-blue">
              <p className="text-sm text-gray-500">Search tracking not yet enabled. Enable the search feature to see what students look for.</p>
            </Card>
          </div>
        );

      case 'journey':
        return (
          <Card title="Learning Funnel — registration to premium">
            <div className="space-y-1">
              {(data.journey || []).map((s: any, i: number) => (
                <div key={s.key} className="flex items-center gap-3 py-2">
                  <span className="w-6 text-gray-400 text-xs font-bold">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800">{s.label}</p>
                      <p className="text-sm text-gray-500">{s.users} users · {s.conversion}%</p>
                    </div>
                    <div className="mt-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-3 bg-blue-500 rounded-full transition-all" style={{ width: `${s.conversion}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );

      case 'learning':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Solved today" value={data.learning?.questions_solved_today || 0} />
              <Stat label="Avg accuracy" value={`${data.learning?.avg_accuracy || 0}%`} />
              <Stat label="Study today" value={`${data.learning?.study_minutes_today || 0} min`} />
              <Stat label="Predicted score" value={`${data.learning?.predicted_score || 0}/100`} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Stat label="Strong subject" value={data.learning?.strong_subject?.name || '—'} sub={data.learning?.strong_subject ? `${data.learning.strong_subject.accuracy}% accuracy, ${data.learning.strong_subject.attempted} attempts` : undefined} color="text-green-600" />
              <Stat label="Weak subject" value={data.learning?.weak_subject?.name || '—'} sub={data.learning?.weak_subject ? `${data.learning.weak_subject.accuracy}% accuracy, ${data.learning.weak_subject.attempted} attempts` : undefined} color="text-red-600" />
            </div>
          </div>
        );

      case 'mock':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Completion" value={`${data.mock?.mocks_completed_pct || 0}%`} />
              <Stat label="Avg time" value={`${data.mock?.avg_minutes || 0} min`} />
              <Stat label="Avg score" value={data.mock?.avg_score || '—'} />
              <Stat label="Most skipped" value={data.mock?.most_skipped_subject || '—'} color="text-red-600" />
            </div>
            <Card title="Highest wrong topics">
              <div className="space-y-2">
                {(data.mock?.highest_wrong_topics || []).map((t: any) => (
                  <div key={t.topic} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium">{t.topic}</span>
                    <span className="text-red-600 font-bold">{t.n} wrong</span>
                  </div>
                ))}
                {(data.mock?.highest_wrong_topics || []).length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
              </div>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title="Slowest topics">
                <div className="space-y-2">
                  {(data.mock?.slowest_topics || []).map((t: any) => (
                    <div key={t.topic} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 font-medium">{t.topic}</span>
                      <span className="text-orange-600 font-bold">{t.avg_time}s avg</span>
                    </div>
                  ))}
                  {(data.mock?.slowest_topics || []).length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
                </div>
              </Card>
              <Card title="Fastest topics">
                <div className="space-y-2">
                  {(data.mock?.fastest_topics || []).map((t: any) => (
                    <div key={t.topic} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 font-medium">{t.topic}</span>
                      <span className="text-green-600 font-bold">{t.avg_time}s avg</span>
                    </div>
                  ))}
                  {(data.mock?.fastest_topics || []).length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
                </div>
              </Card>
            </div>
          </div>
        );

      case 'heatmap':
        return (
          <Card title="Topic Difficulty — accuracy by subject">
            <div className="space-y-3">
              {(data.heatmap || []).map((s: any) => (
                <Bar key={s.subject} label={s.subject} value={s.accuracy} sub={`${s.attempted} attempts`} />
              ))}
              {(data.heatmap || []).length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
            </div>
          </Card>
        );

      case 'dropoffs':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Started mocks" value={data.dropoffs?.started_mock_users || 0} sub="students" />
              <Stat label="Biggest drop" value={data.dropoffs?.biggest_drop_subject || '—'} sub="section where students quit" color="text-red-600" />
            </div>
            <Card title="Reach by section (mock tests)">
              <div className="space-y-3">
                {(data.dropoffs?.by_subject || []).map((s: any) => (
                  <Bar key={s.subject} label={s.subject} value={s.users} max={(data.dropoffs?.started_mock_users || 1)} suffix=" users" />
                ))}
                {(data.dropoffs?.by_subject || []).length === 0 && <p className="text-sm text-gray-500">No mock attempts yet.</p>}
              </div>
            </Card>
          </div>
        );

      case 'retention':
        return (
          <div className="space-y-4">
            <Card title="Cohort retention">
              <div className="space-y-3">
                {[['Day 1', data.retention?.day1], ['Day 7', data.retention?.day7], ['Day 15', data.retention?.day15], ['Day 30', data.retention?.day30]].map(([label, value]) => (
                  <Bar key={label as string} label={label as string} value={value || 0} />
                ))}
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="7-day free users" value={`${data.retention?.free_day7 || 0}%`} color="text-blue-600" />
              <Stat label="7-day premium users" value={`${data.retention?.premium_day7 || 0}%`} color="text-green-600" />
            </div>
          </div>
        );

      case 'personas':
        return (
          <div className="space-y-3">
            {(data.personas || []).map((p: any) => (
              <div key={p.user_id} className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900 flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-600" />
                    {p.persona}
                  </p>
                  <span className="text-xs text-gray-400">user #{p.user_id}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-xs text-gray-400 uppercase">Session</p><p className="font-semibold">{p.avg_session_minutes} min</p></div>
                  <div><p className="text-xs text-gray-400 uppercase">Streak</p><p className="font-semibold">{p.study_streak} days</p></div>
                  <div><p className="text-xs text-gray-400 uppercase">Strong</p><p className="font-semibold text-green-600">{p.favorite_subject || '—'}</p></div>
                  <div><p className="text-xs text-gray-400 uppercase">Weak</p><p className="font-semibold text-red-600">{p.weak_subject || '—'}</p></div>
                </div>
                {p.risk && <p className={`mt-2 text-xs font-bold ${p.risk.includes('churn') ? 'text-red-600' : 'text-blue-600'}`}>⚠ {p.risk}</p>}
              </div>
            ))}
            {(data.personas || []).length === 0 && <p className="text-sm text-gray-500">No student activity yet.</p>}
          </div>
        );

      case 'coach':
        return (
          <div className="space-y-4">
            <Card title="AI Product Coach" className="border-l-4 border-l-purple-500">
              <div className="space-y-2">
                {(data.coach?.summary || []).map((l: string, i: number) => (
                  <p key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                    {l}
                  </p>
                ))}
                {(data.coach?.summary || []).length === 0 && <p className="text-sm text-gray-500">Not enough data for insights yet.</p>}
              </div>
              <div className="mt-5 pt-4 border-t">
                <p className="text-xs font-bold uppercase text-gray-400 mb-2">Recommendations</p>
                <div className="space-y-2">
                  {(data.coach?.recommendations || []).map((r: string, i: number) => (
                    <p key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <Zap className="h-4 w-4 text-lingo-yellow-dark shrink-0 mt-0.5" />
                      {r}
                    </p>
                  ))}
                </div>
              </div>
              {data.coach?.generated_at && (
                <p className="text-xs text-gray-400 mt-4">Generated {new Date(data.coach.generated_at).toLocaleString()}</p>
              )}
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="UX Research"
        wide
        onBack={() => navigate('/admin')}
        right={<Activity className="h-5 w-5 text-blue-600" />}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Module nav */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {MODULES.map(m => (
            <button
              key={m.id}
              onClick={() => setModule(m.id)}
              className={`shrink-0 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                module === m.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <Card><p className="text-sm text-red-600">{error}</p></Card>
        ) : renderModule()}
      </div>
    </div>
  );
};

export default UxResearch;
