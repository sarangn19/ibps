import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { ArrowLeft, Users, Inbox, Target, XCircle } from 'lucide-react';

const CohortView: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<any[]>([]);
  const [batchId, setBatchId] = useState<string>('');

  useEffect(() => {
    api.get('/admin/batches')
      .then(r => setBatches(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = batchId ? `?batch_id=${batchId}` : '';
    api.get(`/admin/cohort${params}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [batchId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;

  const { subjects = [], engagement = {}, score_distribution = [] } = data || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" /><span className="text-sm">Back</span>
            </button>
            <h1 className="text-lg font-bold text-gray-900">Cohort Analytics</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-600">Batch:</label>
            <select value={batchId} onChange={e => setBatchId(e.target.value)} className="border rounded-lg px-3 py-1.5">
              <option value="">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Engagement stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1"><Users className="h-4 w-4" /><span className="text-xs font-medium uppercase">Students</span></div>
            <p className="text-2xl font-bold text-gray-900">{engagement.total_students ?? 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1"><Target className="h-4 w-4" /><span className="text-xs font-medium uppercase">Completed</span></div>
            <p className="text-2xl font-bold text-gray-900">{engagement.tests_completed ?? 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-1"><Inbox className="h-4 w-4" /><span className="text-xs font-medium uppercase">In Progress</span></div>
            <p className="text-2xl font-bold text-gray-900">{engagement.tests_in_progress ?? 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-orange-600 mb-1"><XCircle className="h-4 w-4" /><span className="text-xs font-medium uppercase">Abandoned</span></div>
            <p className="text-2xl font-bold text-gray-900">{engagement.tests_abandoned ?? 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subject accuracy */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b"><h2 className="font-semibold text-gray-900">Subject-wise Accuracy</h2></div>
            <div className="p-4 space-y-4">
              {subjects.length === 0 ? (
                <p className="text-sm text-gray-500">No subject data</p>
              ) : subjects.map((s: any) => (
                <div key={s.subject}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{s.subject}</span>
                    <span className="text-gray-600">{s.accuracy != null ? s.accuracy.toFixed(1) : '—'}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(s.accuracy || 0, 100)}%` }}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{s.total_attempts} attempts · {s.correct_attempts} correct</p>
                </div>
              ))}
            </div>
          </div>

          {/* Score distribution */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b"><h2 className="font-semibold text-gray-900">Score Distribution</h2></div>
            <div className="p-4">
              <div className="space-y-3">
                {score_distribution.length === 0 ? (
                  <p className="text-sm text-gray-500">No score data</p>
                ) : score_distribution.map((d: any) => {
                  const total = score_distribution.reduce((s: number, x: any) => s + parseInt(x.count), 0);
                  const pct = total > 0 ? (parseInt(d.count) / total) * 100 : 0;
                  const colors: Record<string, string> = {
                    'negative': 'bg-red-500',
                    'zero': 'bg-gray-500',
                    '1-25': 'bg-orange-500',
                    '26-50': 'bg-yellow-500',
                    '51-75': 'bg-blue-500',
                    '76+': 'bg-green-500',
                  };
                  const barColor = colors[d.score_range] || 'bg-blue-500';
                  return (
                    <div key={d.score_range} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-16 shrink-0">{d.score_range}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-3">
                        <div className={`${barColor} h-3 rounded-full`} style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{d.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CohortView;
