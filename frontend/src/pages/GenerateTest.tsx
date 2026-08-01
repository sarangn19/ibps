import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { SubjectTree } from '../types';
import { ArrowLeft, Plus, X, Sparkles } from 'lucide-react';

interface SectionRow {
  subject: string;
  topic: string;
  difficulty: string;
  count: number;
}

const emptySection = (): SectionRow => ({ subject: '', topic: '', difficulty: '', count: 25 });

const PO_PRELIMS: SectionRow[] = [
  { subject: 'Quantitative Aptitude', topic: '', difficulty: '', count: 35 },
  { subject: 'Reasoning Ability', topic: '', difficulty: '', count: 35 },
  { subject: 'English Language', topic: '', difficulty: '', count: 30 }
];

const PO_MAINS: SectionRow[] = [
  { subject: 'Quantitative Aptitude', topic: '', difficulty: '', count: 35 },
  { subject: 'Reasoning Ability', topic: '', difficulty: '', count: 45 },
  { subject: 'English Language', topic: '', difficulty: '', count: 35 },
  { subject: 'General Awareness', topic: '', difficulty: '', count: 40 }
];

const GenerateTest: React.FC = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<SubjectTree[]>([]);
  const [type, setType] = useState<'full_mock' | 'sectional' | 'topic_practice'>('full_mock');
  const [examStage, setExamStage] = useState<'prelims' | 'mains'>('prelims');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [negativeMarking, setNegativeMarking] = useState('0.25');
  const [sections, setSections] = useState<SectionRow[]>([...PO_PRELIMS]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ test: any; question_count: number; sections: any[] } | null>(null);

  useEffect(() => {
    api.get('/admin/questions/subjects/tree').then(r => setSubjects(r.data)).catch(() => {});
  }, []);

  const setSection = (i: number, patch: Partial<SectionRow>) =>
    setSections(s => s.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const subjectTotal = (subject: string) =>
    subjects.find(s => s.subject === subject)?.topics.reduce(
      (acc, t) => acc + t.subtopics.reduce((a, st) => a + (st.total || 0), 0), 0) || 0;

  const topicsFor = (subject: string) => subjects.find(s => s.subject === subject)?.topics || [];

  const useTemplate = (rows: SectionRow[]) => { setSections(rows); setType('full_mock'); };

  const handleGenerate = async () => {
    setError(''); setResult(null);
    if (sections.length === 0 || sections.some(s => !s.subject || !s.count || s.count < 1)) {
      setError('Every section needs a subject and a positive count.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title || undefined,
        type,
        exam_stage: examStage,
        duration_minutes: duration ? Number(duration) : undefined,
        negative_marking_ratio: Number(negativeMarking) || 0.25,
        sections: sections.map(s => ({
          subject: s.subject,
          topic: s.topic || undefined,
          difficulty: s.difficulty || undefined,
          count: s.count
        }))
      };
      const res = await api.post('/admin/tests/generate', payload);
      setResult(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to generate test');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" /><span className="text-sm">Back</span>
            </button>
            <h1 className="text-lg font-bold text-gray-900">Generate Test</h1>
          </div>
          <button onClick={handleGenerate} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> {saving ? 'Generating...' : 'Generate Test'}
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Settings */}
        <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Test Type</label>
              <select value={type} onChange={e => setType(e.target.value as any)}
                className="border rounded-lg px-3 py-2 text-sm">
                <option value="full_mock">Full Mock</option>
                <option value="sectional">Sectional</option>
                <option value="topic_practice">Topic Practice</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Exam Stage</label>
              <select value={examStage} onChange={e => setExamStage(e.target.value as any)}
                className="border rounded-lg px-3 py-2 text-sm">
                <option value="prelims">Prelims</option>
                <option value="mains">Mains</option>
              </select>
            </div>
            <div className="flex-1 min-w-[220px]">
              <label className="text-xs font-medium text-gray-500 block mb-1">Title (optional)</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Duration (min)</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                placeholder={type === 'full_mock' ? '60' : '20'}
                className="w-24 border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Negative Mark</label>
              <input type="number" step="0.05" value={negativeMarking} onChange={e => setNegativeMarking(e.target.value)}
                className="w-24 border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => useTemplate(PO_PRELIMS)} className="text-xs px-3 py-1.5 border rounded-lg text-blue-700 hover:bg-blue-50">Prefill IBPS PO Prelims</button>
            <button onClick={() => useTemplate(PO_MAINS)} className="text-xs px-3 py-1.5 border rounded-lg text-blue-700 hover:bg-blue-50">Prefill IBPS PO Mains</button>
            <button onClick={() => setSections([emptySection()])} className="text-xs px-3 py-1.5 border rounded-lg text-gray-600 hover:bg-gray-50">Clear</button>
          </div>
        </div>

        {/* Sections */}
        <div className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Sections</h2>
            <button onClick={() => setSections(s => [...s, emptySection()])}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
              <Plus className="h-4 w-4" /> Add Section
            </button>
          </div>
          {sections.map((s, i) => {
            const avail = s.subject ? subjectTotal(s.subject) : 0;
            return (
              <div key={i} className="flex flex-wrap gap-3 items-end border rounded-lg p-3 bg-gray-50">
                <div className="flex-1 min-w-[180px]">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Subject {s.subject ? `(${avail.toLocaleString('en-IN')} available)` : ''}</label>
                  <select value={s.subject} onChange={e => setSection(i, { subject: e.target.value, topic: '' })}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="">Select subject</option>
                    {subjects.map(sj => <option key={sj.subject} value={sj.subject}>{sj.subject}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Topic</label>
                  <select value={s.topic} onChange={e => setSection(i, { topic: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="">All Topics</option>
                    {topicsFor(s.subject).map(t => <option key={t.topic} value={t.topic}>{t.topic}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Difficulty</label>
                  <select value={s.difficulty} onChange={e => setSection(i, { difficulty: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="">All</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Count</label>
                  <input type="number" min={1} max={200} value={s.count} onChange={e => setSection(i, { count: Number(e.target.value) })}
                    className="w-20 border rounded-lg px-3 py-2 text-sm bg-white" />
                </div>
                <button onClick={() => setSections(rows => rows.filter((_, idx) => idx !== i))}
                  className="text-gray-400 hover:text-red-600 p-1"><X className="h-4 w-4" /></button>
              </div>
            );
          })}
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}

        {result && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 space-y-2">
            <p className="font-semibold">Test generated — {result.question_count} questions</p>
            <p className="text-sm">#{result.test.id} · {result.test.title}</p>
            <ul className="text-sm text-gray-700">
              {result.sections.map((s, i) => (
                <li key={i}>• {s.subject}{s.topic ? ` / ${s.topic}` : ''}: {s.used} of {s.available} (requested {s.requested})</li>
              ))}
            </ul>
            <p className="text-xs text-gray-600">This test now appears on the student dashboard under Tests.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GenerateTest;
