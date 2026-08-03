import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Question, SubjectTree } from '../types';
import PageHeader from '../components/PageHeader';
import { Search, Trash2, Eye, X, Plus } from 'lucide-react';

const emptyForm = () => ({
  subject: '', topic: '', subtopic: '', difficulty: 'medium',
  question_text: '',
  option_a: '', option_b: '', option_c: '', option_d: '', option_e: '',
  correct_option: 'a', explanation: '', exam_stage: 'prelims', tags: '',
  set_title: '', set_type: '', set_stimulus: ''
});

const QuestionBank: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<SubjectTree[]>([]);
  const [stats, setStats] = useState<{ total: number; by_subject: { subject: string; c: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ subject: '', difficulty: '', exam_stage: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const [modal, setModal] = useState<{ mode: 'view' | 'edit' | 'new'; q: any } | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.subject) params.set('subject', filters.subject);
    if (filters.difficulty) params.set('difficulty', filters.difficulty);
    if (filters.exam_stage) params.set('exam_stage', filters.exam_stage);
    if (search) params.set('q', search);
    params.set('limit', String(pageSize));
    params.set('offset', String((page - 1) * pageSize));
    try {
      const res = await api.get(`/admin/questions?${params.toString()}`);
      setQuestions(res.data.questions);
      setTotal(res.data.total);
    } catch (e) {
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [filters, search, page]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  useEffect(() => {
    api.get('/admin/questions/subjects/tree')
      .then(r => setSubjects(r.data))
      .catch(() => {});
    api.get('/admin/questions/stats')
      .then(r => setStats(r.data))
      .catch(() => {});
  }, []);

  const pages = Math.max(Math.ceil(total / pageSize), 1);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const subjectColors = ['bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-purple-100 text-purple-800', 'bg-orange-100 text-orange-800', 'bg-pink-100 text-pink-800', 'bg-teal-100 text-teal-800', 'bg-indigo-100 text-indigo-800'];

  const openNew = () => {
    setForm(emptyForm());
    setError('');
    setModal({ mode: 'new', q: null });
  };

  const openEdit = (q: Question) => {
    setForm({
      subject: q.subject, topic: q.topic, subtopic: q.subtopic || '', difficulty: q.difficulty,
      question_text: q.question_text,
      option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, option_e: q.option_e || '',
      correct_option: q.correct_option, explanation: q.explanation || '', exam_stage: q.exam_stage,
      tags: Array.isArray(q.tags) ? q.tags.join(',') : (q.tags || ''),
      set_title: q.set_title || '', set_type: q.set_type || 'group', set_stimulus: q.set_stimulus || ''
    });
    setError('');
    setModal({ mode: 'edit', q });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      set_title: form.set_title || undefined,
      set_type: form.set_type || undefined,
      set_stimulus: form.set_stimulus || undefined
    };
    try {
      if (modal?.mode === 'new') {
        await api.post('/questions', payload);
      } else if (modal?.q) {
        await api.put(`/admin/questions/${modal.q.id}`, payload);
      }
      setModal(null);
      fetchQuestions();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (deletingId) return;
    if (!window.confirm('Delete this question permanently?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/admin/questions/${id}`);
      fetchQuestions();
    } catch (e) {
      setError('Failed to delete question');
    } finally {
      setDeletingId(null);
    }
  };

  const tagColor = (d: string) =>
    d === 'easy' ? 'bg-green-100 text-green-800' : d === 'hard' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
  const stageColor = (s: string) => s === 'mains' ? 'bg-orange-100 text-orange-800' : 'bg-teal-100 text-teal-800';

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Question Bank"
        wide
        onBack={() => navigate('/admin')}
        right={
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/admin/tests/generate')} className="flex items-center gap-2 px-3 py-2 bg-white border text-sm text-gray-700 rounded-lg hover:bg-gray-50 hidden sm:flex">
              <Plus className="h-4 w-4" /> Generate Test
            </button>
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 whitespace-nowrap">
              <Plus className="h-4 w-4" /> Add Question
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-xs font-medium uppercase text-gray-500 mb-1">Total Questions</p>
            <p className="text-3xl font-bold text-blue-600">{stats ? stats.total.toLocaleString('en-IN') : '—'}</p>
          </div>
          {(stats?.by_subject || []).map((s, i) => (
            <div key={s.subject} className="bg-white rounded-lg shadow-sm border p-4">
              <p className="text-xs font-medium uppercase text-gray-500 mb-1 line-clamp-1" title={s.subject}>{s.subject}</p>
              <p className={`text-3xl font-bold ${subjectColors[i % subjectColors.length]}`}>{s.c.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search questions..."
              className="pl-9 pr-3 py-2 border rounded-lg text-sm w-full"
            />
          </div>
          <select
            value={filters.subject}
            onChange={e => { setFilters(f => ({ ...f, subject: e.target.value })); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s.subject} value={s.subject}>{s.subject}</option>)}
          </select>
          <select
            value={filters.difficulty}
            onChange={e => { setFilters(f => ({ ...f, difficulty: e.target.value })); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select
            value={filters.exam_stage}
            onChange={e => { setFilters(f => ({ ...f, exam_stage: e.target.value })); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Stages</option>
            <option value="prelims">Prelims</option>
            <option value="mains">Mains</option>
          </select>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading...</div>
          ) : questions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No questions match.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left p-3 font-medium">ID</th>
                    <th className="text-left p-3 font-medium">Question</th>
                    <th className="text-left p-3 font-medium">Subject / Topic</th>
                    <th className="text-center p-3 font-medium">Difficulty</th>
                    <th className="text-center p-3 font-medium">Stage</th>
                    <th className="text-center p-3 font-medium">Answer</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {questions.map(q => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-500">{q.id}</td>
                      <td className="p-3 max-w-md">
                        <p className="text-gray-900 line-clamp-2">{q.question_text}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-gray-900">{q.subject}</p>
                        <p className="text-xs text-gray-500">{q.topic}{q.subtopic ? ' · ' + q.subtopic : ''}</p>
                        {q.set_title && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] rounded-full bg-indigo-100 text-indigo-700">
                            set · {q.set_type} · {q.set_title}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center"><span className={`px-2 py-0.5 text-xs rounded-full ${tagColor(q.difficulty)}`}>{q.difficulty}</span></td>
                      <td className="p-3 text-center"><span className={`px-2 py-0.5 text-xs rounded-full ${stageColor(q.exam_stage)}`}>{q.exam_stage}</span></td>
                      <td className="p-3 text-center font-semibold text-gray-700">{q.correct_option.toUpperCase()}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(q)} title="View / Edit" className="p-2 rounded-lg text-gray-600 hover:bg-gray-100">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => remove(q.id)} disabled={deletingId === q.id} title="Delete" className="p-2 rounded-lg text-red-600 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && questions.length > 0 && (
          <div className="flex items-center justify-between gap-3 bg-white rounded-lg shadow-sm border px-4 py-3">
            <span className="text-sm text-gray-600 hidden sm:inline">
              Showing {from}–{to} of {total.toLocaleString('en-IN')}
            </span>
            <div className="flex items-center gap-2 ml-auto sm:ml-0">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-sm text-gray-600 whitespace-nowrap">Page {page} of {pages}</span>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-1.5 border rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-gray-900">
                {modal.mode === 'new' ? 'Add Question' : modal.mode === 'edit' ? `Edit Question #${modal.q.id}` : 'View Question'}
              </h2>
              <button onClick={() => setModal(null)} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                  <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Topic</label>
                  <input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Subtopic</label>
                  <input value={form.subtopic} onChange={e => setForm(f => ({ ...f, subtopic: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Difficulty</label>
                    <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))} className="w-full border rounded-lg px-2 py-2 text-sm">
                      <option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option>
                    </select></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
                    <select value={form.exam_stage} onChange={e => setForm(f => ({ ...f, exam_stage: e.target.value }))} className="w-full border rounded-lg px-2 py-2 text-sm">
                      <option value="prelims">prelims</option><option value="mains">mains</option>
                    </select></div>
                </div>
              </div>

              <div><label className="block text-xs font-medium text-gray-600 mb-1">Question Text</label>
                <textarea value={form.question_text} onChange={e => setForm(f => ({ ...f, question_text: e.target.value }))} rows={4} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>

              <div className="space-y-2">
                {['a', 'b', 'c', 'd', 'e'].map(opt => (
                  <div key={opt} className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-700 w-5">{opt.toUpperCase()}.</span>
                    <input
                      value={form[`option_${opt}` as keyof typeof form] as string}
                      onChange={e => setForm(f => ({ ...f, [`option_${opt}`]: e.target.value }))}
                      placeholder={opt === 'e' ? 'Option E (optional)' : `Option ${opt.toUpperCase()}`}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      type="radio"
                      name="correct"
                      checked={form.correct_option === opt}
                      onChange={() => setForm(f => ({ ...f, correct_option: opt }))}
                      className="h-4 w-4"
                      title="Correct answer"
                    />
                  </div>
                ))}
                <p className="text-xs text-gray-500">Select the radio button next to the correct option.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Explanation</label>
                  <textarea value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Tags (comma separated)</label>
                  <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}

              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Shared Set (optional — for DI tables, reading passages, puzzle clues)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Set Title</label>
                    <input value={form.set_title} onChange={e => setForm(f => ({ ...f, set_title: e.target.value }))} placeholder="e.g. DI Table — Set 1" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Set Type</label>
                    <select value={form.set_type} onChange={e => setForm(f => ({ ...f, set_type: e.target.value }))} className="w-full border rounded-lg px-2 py-2 text-sm">
                      <option value="di">di</option><option value="rc">rc</option><option value="puzzle">puzzle</option>
                      <option value="cloze">cloze</option><option value="group">group</option><option value="other">other</option>
                    </select></div>
                </div>
                <div className="mt-3"><label className="block text-xs font-medium text-gray-600 mb-1">Stimulus (table / passage / clues shown above all questions in the set)</label>
                  <textarea value={form.set_stimulus} onChange={e => setForm(f => ({ ...f, set_stimulus: e.target.value }))} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" /></div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t sticky bottom-0 bg-white">
              <button onClick={() => setModal(null)} className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : modal.mode === 'new' ? 'Create Question' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;
