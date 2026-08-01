import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Users, BarChart3, AlertTriangle, Search, ChevronRight, Clock, Award, TrendingUp, Upload, FileSpreadsheet } from 'lucide-react';

interface Student {
  id: number; name: string; email: string; batch_name: string;
  tests_completed: number; avg_score: number; last_active: string;
}

interface Flag {
  student_id: number; student_name: string; type: string; severity: string; message: string; batch: string;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploadState, setUploadState] = useState<string>('idle');
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      api.get('/admin/students').then(r => setStudents(r.data)).catch(() => {}),
      api.get('/admin/flags').then(r => setFlags(r.data)).catch(() => {})
    ]).finally(() => setLoading(false));
  }, []);

  const downloadTemplate = async () => {
    try {
      const res = await api.get('/admin/questions/template', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'question_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setUploadError('Failed to download template');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState('uploading');
    setUploadError('');
    setUploadResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post('/admin/questions/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult(res.data);
      setUploadState('done');
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Upload failed');
      setUploadState('idle');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const severityColor = (sev: string) =>
    sev === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';

  const typeIcon = (type: string) => {
    switch (type) {
      case 'inactivity': return <Clock className="h-4 w-4" />;
      case 'accuracy_drop': return <TrendingUp className="h-4 w-4" />;
      case 'timeout_pattern': return <AlertTriangle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1"><Users className="h-4 w-4" /><span className="text-xs font-medium uppercase">Students</span></div>
            <p className="text-2xl font-bold text-gray-900">{students.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1"><Award className="h-4 w-4" /><span className="text-xs font-medium uppercase">Tests Taken</span></div>
            <p className="text-2xl font-bold text-gray-900">{students.reduce((s, st) => s + st.tests_completed, 0)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-1"><BarChart3 className="h-4 w-4" /><span className="text-xs font-medium uppercase">Avg Score</span></div>
            <p className="text-2xl font-bold text-gray-900">
              {students.length > 0 ? (students.reduce((s, st) => s + (st.avg_score || 0), 0) / students.length).toFixed(1) : '—'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-red-600 mb-1"><AlertTriangle className="h-4 w-4" /><span className="text-xs font-medium uppercase">Flags</span></div>
            <p className="text-2xl font-bold text-gray-900">{flags.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Student table */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">All Students</h2>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search students..."
                  className="pl-9 pr-3 py-2 border rounded-lg text-sm w-48"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Batch</th>
                    <th className="text-center p-3 font-medium">Tests</th>
                    <th className="text-center p-3 font-medium">Avg Score</th>
                    <th className="text-center p-3 font-medium">Last Active</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/students/${s.id}`)}>
                      <td className="p-3">
                        <p className="font-medium text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.email}</p>
                      </td>
                      <td className="p-3 text-gray-600">{s.batch_name || '—'}</td>
                      <td className="p-3 text-center font-medium">{s.tests_completed}</td>
                      <td className="p-3 text-center">{s.avg_score ? `${s.avg_score}` : '—'}</td>
                      <td className="p-3 text-center text-xs text-gray-500">
                        {s.last_active ? new Date(s.last_active).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="p-3 text-right"><ChevronRight className="h-4 w-4 text-gray-400 inline" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Flags panel */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Automated Flags
              </h2>
            </div>
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {flags.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No flags raised</p>
              ) : flags.map((f, i) => (
                <div key={i} className="p-3 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/students/${f.student_id}`)}>
                  <div className="flex items-start gap-2">
                    <span className={severityColor(f.severity) + ' p-1 rounded-full'}>{typeIcon(f.type)}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{f.student_name}</p>
                      <p className="text-xs text-gray-600">{f.message}</p>
                      <div className="flex gap-1 mt-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${severityColor(f.severity)}`}>{f.severity}</span>
                        <span className="text-xs text-gray-400">{f.type.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upload questions */}
        <div className="bg-white rounded-lg shadow-sm border p-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
            <Upload className="h-4 w-4 text-blue-600" />
            Upload Questions
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Bulk-import questions from an Excel (.xlsx/.xls) or CSV file. Download the template for the required columns.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-gray-100 border rounded-lg text-sm text-gray-700 hover:bg-gray-200 flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Download Template
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="text-sm" />
          </div>
          {uploadState === 'uploading' && (
            <p className="mt-3 text-sm text-gray-600">Uploading and importing...</p>
          )}
          {uploadResult && (
            <div className="mt-3 text-sm space-y-1">
              <p className={uploadResult.inserted > 0 ? 'text-green-700 font-medium' : 'text-gray-700 font-medium'}>
                Imported {uploadResult.inserted} of {uploadResult.total} questions.
              </p>
              {uploadResult.errors.length > 0 && (
                <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <p className="text-red-700 font-medium mb-1">Skipped rows:</p>
                  {uploadResult.errors.map((err: any, i: number) => (
                    <p key={i} className="text-xs text-red-600">Row {err.row}: {err.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          {uploadError && <p className="mt-3 text-sm text-red-600">{uploadError}</p>}
        </div>

        {/* Quick links */}
        <div className="flex gap-3">
          <button onClick={() => navigate('/admin/cohort')} className="px-4 py-2 bg-white border rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            View Cohort Analytics
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminNav: React.FC = () => (
  <nav className="bg-white shadow-sm border-b">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-gray-900">IBPS Coaching — Admin</h1>
        <div className="flex gap-3 text-sm">
          <a href="/admin" className="text-blue-600 font-medium">Dashboard</a>
          <a href="/admin/questions" className="text-gray-600 hover:text-gray-900">Question Bank</a>
          <a href="/admin/tests/generate" className="text-gray-600 hover:text-gray-900">Generate Test</a>
          <a href="/admin/cohort" className="text-gray-600 hover:text-gray-900">Cohort</a>
        </div>
      </div>
      <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">Switch to Student View</a>
    </div>
  </nav>
);

export default AdminDashboard;
