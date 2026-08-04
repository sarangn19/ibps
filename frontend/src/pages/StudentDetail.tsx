import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import PageHeader from '../components/PageHeader';
import { Clock, Brain, Gift } from 'lucide-react';

const classificationColor = (cls: string) => {
  switch (cls) {
    case 'strong': return 'text-green-600 bg-green-50';
    case 'developing': return 'text-blue-600 bg-blue-50';
    case 'weak': return 'text-red-600 bg-red-50';
    default: return 'text-gray-400 bg-gray-50';
  }
};

const StudentDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/students/${id}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-600">Student not found</p></div>;

  const { student, attempts, mastery, logs, trends, question_attempts, referral } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={student.name}
        wide
        onBack={() => navigate('/admin')}
        right={
          <>
            <span className="text-sm text-gray-500 hidden sm:inline">{student.email}</span>
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">{student.batch_name || 'No batch'}</span>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Attempts + Trends */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <p className="text-xs text-gray-500 uppercase">Tests Completed</p>
              <p className="text-2xl font-bold text-gray-900">{attempts.filter((a: any) => a.status === 'completed').length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <p className="text-xs text-gray-500 uppercase">Avg Score</p>
              <p className="text-2xl font-bold text-gray-900">
                {attempts.filter((a: any) => a.status === 'completed').length > 0
                  ? (attempts.filter((a: any) => a.status === 'completed').reduce((s: number, a: any) => s + (a.total_score || 0), 0) / attempts.filter((a: any) => a.status === 'completed').length).toFixed(1)
                  : '—'}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <p className="text-xs text-gray-500 uppercase">Mastery Topics</p>
              <p className="text-2xl font-bold text-gray-900">{mastery.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <p className="text-xs text-gray-500 uppercase">Questions Attempted</p>
              <p className="text-2xl font-bold text-gray-900">{question_attempts.length}</p>
            </div>
          </div>

          {/* Referrals */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Gift className="h-4 w-4 text-green-600" />
                Referrals
              </h2>
            </div>
            <div className="divide-y">
              <div className="p-4">
                {referral?.referred_by ? (
                  <p className="text-sm text-gray-600">
                    Referred by{' '}
                    <span className="font-semibold text-gray-900">{referral.referred_by.name}</span>
                    {referral.referred_by.referral_code && (
                      <span className="text-xs text-gray-400 ml-1">(code {referral.referred_by.referral_code})</span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">No one referred this student.</p>
                )}
                {referral?.code && (
                  <p className="text-xs text-gray-400 mt-1">
                    Their code: <span className="font-bold tracking-widest">{referral.code}</span>
                  </p>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{(referral?.referred_users || []).length}</p>
                    <p className="text-xs text-gray-500 uppercase">Brought</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{referral?.referred_users?.filter((u: any) => u.is_paid).length || 0}</p>
                    <p className="text-xs text-gray-500 uppercase">Paid</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-400">{referral?.referred_users?.filter((u: any) => !u.is_paid).length || 0}</p>
                    <p className="text-xs text-gray-500 uppercase">Unpaid</p>
                  </div>
                </div>
              </div>

              {(referral?.referred_users || []).length > 0 && (
                <div className="max-h-64 overflow-y-auto divide-y">
                  {(referral?.referred_users || []).map((u: any) => (
                    <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {u.email} · joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${
                        u.is_paid ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.is_paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Attempt History */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b"><h2 className="font-semibold text-gray-900">Attempt History</h2></div>
            <div className="divide-y">
              {attempts.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No attempts yet</p>
              ) : attempts.map((a: any) => (
                <div key={a.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{a.test_title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {new Date(a.started_at).toLocaleDateString()} · {a.test_type?.replace(/_/g, ' ')}
                      {a.total_score !== null && ` · Score: ${a.total_score}`}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${
                    a.status === 'completed' ? 'bg-green-100 text-green-800' :
                    a.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>{a.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Question Attempt Log */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Question Attempt Log</h2>
              <p className="text-xs text-gray-500 mt-0.5">Every question this student attempted, with timestamps</p>
            </div>
            {question_attempts.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No question attempts yet</p>
            ) : (
              <div className="max-h-[32rem] overflow-y-auto divide-y">
                {question_attempts.map((q: any) => (
                  <div key={q.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">{q.question_text}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {q.subject} &gt; {q.topic} · {q.test_title}
                        </p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${
                        q.is_correct === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {q.is_correct === 1 ? 'Correct' : 'Wrong'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                      <span>Answered: <span className="font-mono uppercase">{q.selected_option}</span></span>
                      {q.is_correct !== 1 && (
                        <span>Correct: <span className="font-mono uppercase">{q.correct_option}</span></span>
                      )}
                      <span className="text-gray-400 ml-auto">{new Date(q.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Score Trend Chart */}
          {trends.length > 1 && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Score Trend</h2>
              <div className="flex items-end gap-2 h-32 overflow-x-auto pb-1">
                {trends.map((t: any, i: number) => {
                  const maxScore = Math.max(...trends.map((x: any) => x.total_score || 0), 1);
                  const height = ((t.total_score || 0) / maxScore) * 100;
                  return (
                    <div key={i} className="flex-1 min-w-[24px] flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-600 whitespace-nowrap">{t.total_score?.toFixed(1)}</span>
                      <div className="w-full bg-blue-100 rounded-t" style={{ height: `${Math.max(height, 4)}%` }}>
                        <div className="bg-blue-600 w-full rounded-t" style={{ height: `${height}%` }}></div>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(t.date).toLocaleDateString().slice(0, 5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Mastery + Logs */}
        <div className="space-y-6">
          {/* Expertise Map */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b"><h2 className="font-semibold text-gray-900 flex items-center gap-2"><Brain className="h-4 w-4" /> Expertise Map</h2></div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {mastery.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No mastery data</p>
              ) : mastery.map((m: any) => (
                <div key={m.id} className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.subtopic}</p>
                      <p className="text-xs text-gray-500">{m.subject} &gt; {m.topic}</p>
                    </div>
                    <span className={`px-1.5 py-0.5 text-xs rounded-full ${classificationColor(m.classification)}`}>{m.classification}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${m.classification === 'strong' ? 'bg-green-500' : m.classification === 'developing' ? 'bg-blue-500' : 'bg-red-500'}`}
                      style={{ width: `${m.mastery_score}%` }}></div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span>{m.mastery_score.toFixed(0)}%</span>
                    <span>{m.attempt_count} attempts</span>
                    <span>{m.accuracy_rolling.toFixed(0)}% acc</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b"><h2 className="font-semibold text-gray-900 flex items-center gap-2"><Clock className="h-4 w-4" /> Recent Activity</h2></div>
            <div className="divide-y max-h-60 overflow-y-auto text-sm">
              {logs.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No activity logs</p>
              ) : logs.slice(0, 20).map((log: any) => (
                <div key={log.id} className="px-4 py-2 flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-16 shrink-0">{new Date(log.timestamp).toLocaleDateString()}</span>
                  <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                    log.event_type === 'login' ? 'bg-blue-100 text-blue-700' :
                    log.event_type === 'test_started' ? 'bg-lingo-blue/15 text-lingo-blue-dark' :
                    log.event_type === 'test_submitted' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>{log.event_type.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDetail;
