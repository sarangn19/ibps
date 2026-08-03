import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import PageHeader from '../components/PageHeader';
import { Users, User, ArrowLeft, Calendar, Target, Trophy, Activity, Flame, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

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

const RISK_BADGE: Record<string, { cls: string; label: string }> = {
  green: { cls: 'bg-green-100 text-green-700', label: 'Excellent' },
  yellow: { cls: 'bg-yellow-100 text-yellow-700', label: 'Needs Attention' },
  red: { cls: 'bg-red-100 text-red-700', label: 'At Risk' },
};

const TYPE_LABEL: Record<string, { label: string; icon: string; cls: string }> = {
  login: { label: 'Login', icon: '👤', cls: 'bg-gray-100 text-gray-700' },
  test_started: { label: 'Started Test', icon: '📝', cls: 'bg-blue-100 text-blue-700' },
  test_submitted: { label: 'Submitted Test', icon: '✅', cls: 'bg-green-100 text-green-700' },
  attempt_started: { label: 'Test Started', icon: '📝', cls: 'bg-blue-100 text-blue-700' },
  attempt_completed: { label: 'Test Completed', icon: '✅', cls: 'bg-green-100 text-green-700' },
  attempt_abandoned: { label: 'Test Abandoned', icon: '🚫', cls: 'bg-red-100 text-red-700' },
  question_correct: { label: 'Correct Answer', icon: '✔️', cls: 'bg-green-100 text-green-700' },
  question_wrong: { label: 'Wrong Answer', icon: '✘', cls: 'bg-red-100 text-red-700' },
  question_skipped: { label: 'Skipped Question', icon: '⏭️', cls: 'bg-yellow-100 text-yellow-700' },
};

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString();
};

const parseDetail = (type: string, detail: string) => {
  if (!detail) return '';
  try {
    const j = JSON.parse(detail);
    if (type === 'login' && j.timestamp) return 'App opened';
    return Object.entries(j).map(([k, v]) => `${k}: ${v}`).join(' · ');
  } catch {
    return detail;
  }
};

const StudentList: React.FC = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    api.get('/admin/research/students')
      .then(res => setStudents(res.data.students || []))
      .catch(() => setError('Failed to load students'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(s => {
    if (filter !== 'all' && s.risk !== filter) return false;
    if (q && !((s.name || '').toLowerCase().includes(q.toLowerCase()) || (s.email || '').toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Every Active Student"
        wide
        onBack={() => navigate('/admin/research')}
        right={<Users className="h-5 w-5 text-blue-600" />}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Total students" value={students.length} color="text-blue-600" />
          <Stat label="At risk" value={students.filter(s => s.risk === 'red').length} color="text-red-600" sub="churn risk" />
          <Stat label="Needs attention" value={students.filter(s => s.risk === 'yellow').length} color="text-yellow-600" />
          <Stat label="Excellent" value={students.filter(s => s.risk === 'green').length} color="text-green-600" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {[
              ['all', 'All'],
              ['green', 'Excellent'],
              ['yellow', 'Attention'],
              ['red', 'At Risk'],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                  filter === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search name or email..."
            className="flex-1 px-3 py-1.5 border rounded-lg text-sm min-w-0"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <Card><p className="text-sm text-red-600">{error}</p></Card>
        ) : filtered.length === 0 ? (
          <Card><p className="text-sm text-gray-500">No students found. Data will appear here as students register and study.</p></Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Sessions</th>
                  <th className="px-4 py-3">Study</th>
                  <th className="px-4 py-3">Solved</th>
                  <th className="px-4 py-3">Accuracy</th>
                  <th className="px-4 py-3">Streak</th>
                  <th className="px-4 py-3">Strong</th>
                  <th className="px-4 py-3">Weak</th>
                  <th className="px-4 py-3">Mock</th>
                  <th className="px-4 py-3">Plan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const rb = RISK_BADGE[s.risk] || RISK_BADGE.green;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/admin/research/students/${s.id}`)}
                      className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[180px]">{s.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${rb.cls}`}>
                          {s.risk === 'red' ? <XCircle className="h-3 w-3" /> : s.risk === 'yellow' ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          {rb.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">{s.active_days || 0} days</td>
                      <td className="px-4 py-3">{s.sessions || 0}</td>
                      <td className="px-4 py-3">{s.study_minutes || 0} min</td>
                      <td className="px-4 py-3">{s.questions_solved || 0}</td>
                      <td className="px-4 py-3 font-semibold">{s.accuracy || 0}%</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1">
                          <Flame className={`h-4 w-4 ${(s.streak || 0) >= 2 ? 'text-orange-500' : 'text-gray-300'}`} />
                          {s.streak || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-green-600">{s.strong_subject || '—'}</td>
                      <td className="px-4 py-3 text-red-600">{s.weak_subject || '—'}</td>
                      <td className="px-4 py-3">{s.latest_mock_score != null ? `${s.latest_mock_score}/100` : '—'}</td>
                      <td className="px-4 py-3">
                        {s.is_premium ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Premium</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">Free</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
};

const StudentDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/admin/research/students/${id}`)
      .then(res => setD(res.data))
      .catch(() => setError('Failed to load student detail'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  if (error || !d) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Student 360" wide onBack={() => navigate('/admin/research/students')} />
        <div className="max-w-7xl mx-auto px-4 py-6"><Card><p className="text-sm text-red-600">{error || 'Student not found'}</p></Card></div>
      </div>
    );
  }

  const p = d.profile || {};
  const l = d.learning || {};
  const rb = RISK_BADGE[p.risk] || (p.is_premium ? RISK_BADGE.green : RISK_BADGE.yellow);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={p.name}
        wide
        onBack={() => navigate('/admin/research/students')}
        right={<User className="h-5 w-5 text-blue-600" />}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Profile card */}
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 truncate">{p.name}</h2>
              <p className="text-sm text-gray-500 truncate">{p.email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                  <Target className="h-3 w-3" /> {p.exam_goal || 'No exam goal'}
                </span>
                {p.target_year && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    <Calendar className="h-3 w-3" /> {p.target_year}
                  </span>
                )}
                {p.prep_level && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    <Activity className="h-3 w-3" /> {p.prep_level}
                  </span>
                )}
                {p.is_premium ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                    <Trophy className="h-3 w-3" /> Premium
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">Free</span>
                )}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${rb.cls}`}>
                  {p.is_premium ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {p.is_premium ? 'Excellent' : 'Needs Attention'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{l.active_days || 0}</p>
                <p className="text-xs text-gray-500">active days</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{l.streak || 0}<Flame className="inline h-4 w-4 text-orange-500" /></p>
                <p className="text-xs text-gray-500">streak</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{l.accuracy || 0}%</p>
                <p className="text-xs text-gray-500">accuracy</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{l.sessions || 0}</p>
                <p className="text-xs text-gray-500">sessions</p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Learning stats */}
          <div className="space-y-6">
            <Card title="Learning">
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-sm text-gray-500">Questions solved</span><span className="text-sm font-semibold">{l.questions_solved || 0}</span></div>
                <div className="flex justify-between"><span className="text-sm text-gray-500">Study time</span><span className="text-sm font-semibold">{l.study_minutes || 0} min</span></div>
                <div className="flex justify-between"><span className="text-sm text-gray-500">Avg speed</span><span className="text-sm font-semibold">{l.avg_speed || 0}s / q</span></div>
                <div className="flex justify-between"><span className="text-sm text-gray-500">Daily goal</span><span className="text-sm font-semibold">{p.daily_study_minutes ? `${p.daily_study_minutes} min` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-sm text-gray-500">Onboarding</span><span className="text-sm font-semibold">{p.onboarding_completed ? 'Completed' : 'Incomplete'}</span></div>
                <div className="flex justify-between"><span className="text-sm text-gray-500">Joined</span><span className="text-sm font-semibold">{fmtDate(p.joined)}</span></div>
              </div>
            </Card>

            <Card title="Strengths & Weaknesses">
              <div className="space-y-3">
                <p className="text-xs uppercase text-gray-400 font-medium">Strong</p>
                {(l.strong_topics || []).length === 0 && <p className="text-sm text-gray-400">No data yet</p>}
                {(l.strong_topics || []).map((t: any, i: number) => (
                  <div key={i} className="flex justify-between"><span className="text-sm text-green-700">{t.subject} · {t.topic}</span><span className="text-sm font-semibold text-green-600">{t.accuracy}%</span></div>
                ))}
                <p className="text-xs uppercase text-gray-400 font-medium pt-2">Weak</p>
                {(l.weak_topics || []).length === 0 && <p className="text-sm text-gray-400">No data yet</p>}
                {(l.weak_topics || []).map((t: any, i: number) => (
                  <div key={i} className="flex justify-between"><span className="text-sm text-red-700">{t.subject} · {t.topic}</span><span className="text-sm font-semibold text-red-600">{t.accuracy}%</span></div>
                ))}
              </div>
            </Card>

            <Card title="Subject accuracy">
              {(d.subjects || []).length === 0 && <p className="text-sm text-gray-400">No data yet</p>}
              <div className="space-y-3">
                {(d.subjects || []).map((s: any) => (
                  <div key={s.subject}>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">{s.subject}</span>
                      <span className="font-semibold">{s.accuracy}% · {s.attempted} q</span>
                    </div>
                    <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-2 rounded-full ${s.accuracy >= 70 ? 'bg-green-500' : s.accuracy >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${s.accuracy}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {p.referral_code && (
              <Card title="Referral">
                <div className="flex justify-between"><span className="text-sm text-gray-500">Code</span><span className="text-sm font-semibold font-mono">{p.referral_code}</span></div>
                <div className="flex justify-between"><span className="text-sm text-gray-500">Referred by</span><span className="text-sm font-semibold">{p.referred_by ? `#${p.referred_by}` : '—'}</span></div>
              </Card>
            )}
          </div>

          {/* Mock scores + mastery */}
          <div className="space-y-6">
            <Card title="Mock scores">
              {(d.mock_scores || []).length === 0 && <p className="text-sm text-gray-400">No full mocks yet</p>}
              <div className="space-y-3">
                {(d.mock_scores || []).map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{m.title}</p>
                      <p className="text-xs text-gray-400">{fmtDate(m.started_at)}</p>
                    </div>
                    <span className="text-sm font-bold text-blue-600">{m.score}/100</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Topic mastery">
              {(d.mastery || []).length === 0 && <p className="text-sm text-gray-400">No mastery data yet</p>}
              <div className="space-y-2">
                {(d.mastery || []).slice(0, 12).map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-700 truncate">{m.subject} · {m.topic}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                        m.classification === 'strong' ? 'bg-green-100 text-green-700' : m.classification === 'developing' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>{m.classification}</span>
                      <span className="text-sm font-semibold w-8 text-right">{m.score}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Timeline */}
          <Card title="Journey timeline" className="md:col-span-1">
            {(d.timeline || []).length === 0 && <p className="text-sm text-gray-400">No activity yet</p>}
            <div className="relative pl-5 border-l-2 border-gray-100 space-y-4">
              {(d.timeline || []).slice(0, 40).map((t: any, i: number) => {
                const meta = TYPE_LABEL[t.type] || { label: t.type, icon: '•', cls: 'bg-gray-100 text-gray-700' };
                return (
                  <div key={i} className="relative">
                    <span className={`absolute -left-[26px] top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${t.type === 'login' ? 'bg-gray-300' : t.type.includes('correct') || t.type.includes('completed') || t.type === 'test_submitted' ? 'bg-green-500' : t.type.includes('wrong') || t.type.includes('abandoned') ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                    <p className="text-xs text-gray-400">{fmtDate(t.time)}</p>
                    <p className="text-sm text-gray-800">{meta.icon} <span className="font-semibold">{meta.label}</span></p>
                    {t.detail && <p className="text-xs text-gray-500 mt-0.5">{parseDetail(t.type, t.detail)}</p>}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-center">
          <Link to="/admin/research" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to UX Research
          </Link>
        </div>
      </div>
    </div>
  );
};

const Student360: React.FC = () => {
  const { id } = useParams();
  return id ? <StudentDetail /> : <StudentList />;
};

export default Student360;
