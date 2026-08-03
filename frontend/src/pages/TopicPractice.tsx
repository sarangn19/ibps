import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SubjectTree } from '../types';
import api from '../utils/api';
import MobileNav from '../components/MobileNav';
import PageHeader from '../components/PageHeader';
import { ChevronRight, Play } from 'lucide-react';

const TopicPractice: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedSubject = searchParams.get('subject') || '';
  const preselectedTopic = searchParams.get('topic') || '';

  const [subjects, setSubjects] = useState<SubjectTree[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>(preselectedSubject);
  const [selectedTopic, setSelectedTopic] = useState<string>(preselectedTopic);
  const [selectedSubtopic, setSelectedSubtopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [timed, setTimed] = useState(true);
  const [duration, setDuration] = useState(15);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api.get('/questions/subjects/tree')
      .then(res => setSubjects(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const currentSubject = subjects.find(s => s.subject === selectedSubject);
  const currentTopic = currentSubject?.topics.find(t => t.topic === selectedTopic);
  const totalInTopic = currentTopic?.subtopics.reduce((s, st) => s + st.total, 0) || 0;

  const handleStart = async () => {
    setStarting(true);
    try {
      const body: Record<string, any> = {
        subject: selectedSubject || undefined,
        topic: selectedTopic || undefined,
        subtopic: selectedSubtopic || undefined,
        difficulty: difficulty || undefined,
        count: questionCount,
        timed,
        duration_minutes: duration
      };
      Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);

      const res = await api.post('/practice/start', body);
      navigate(`/test/${res.data.test.id}`);
    } catch (err: any) {
      console.error('Failed to start practice:', err);
      alert(err.response?.data?.error || 'Failed to start practice');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lingo-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-lingo-border border-t-lingo-green"></div>
      </div>
    );
  }

  const selectClass = (active: boolean) =>
    active
      ? 'bg-lingo-green/15 border-lingo-green text-lingo-green-dark font-bold'
      : 'bg-white border-lingo-border text-gray-600 font-semibold hover:border-lingo-green';

  return (
    <div className="min-h-screen bg-lingo-bg">
      <PageHeader title="Practice by Topic" onBack={() => navigate('/dashboard')} />

      <div className="max-w-lg mx-auto px-4 pt-5 pb-nav">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-1 text-sm text-gray-500 font-semibold mb-6">
          <span>Subjects</span>
          {selectedSubject && <><ChevronRight className="h-3 w-3 shrink-0" /><span className="text-gray-900 font-bold min-w-0 truncate">{selectedSubject}</span></>}
          {selectedTopic && <><ChevronRight className="h-3 w-3 shrink-0" /><span className="text-gray-900 font-bold min-w-0 truncate">{selectedTopic}</span></>}
          {selectedSubtopic && <><ChevronRight className="h-3 w-3 shrink-0" /><span className="text-gray-900 font-bold min-w-0 truncate">{selectedSubtopic}</span></>}
        </div>

        {/* Step 1: Pick Subject */}
        {!selectedSubject && (
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 mb-3">Select a Subject</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {subjects.map(s => (
                <button
                  key={s.subject}
                  onClick={() => { setSelectedSubject(s.subject); setSelectedTopic(''); }}
                  className="lingo-card p-4 text-left hover:-translate-y-0.5 transition-transform"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-extrabold text-gray-900">{s.subject}</p>
                      <p className="text-xs text-gray-500 mt-0.5 font-semibold">{s.topics.length} topics</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-lingo-green" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Pick Topic */}
        {selectedSubject && !selectedTopic && currentSubject && (
          <div>
            <button onClick={() => setSelectedSubject('')} className="text-sm text-lingo-blue font-extrabold hover:underline mb-3">← All Subjects</button>
            <h2 className="text-lg font-extrabold text-gray-900 mb-3">Select a Topic in {selectedSubject}</h2>
            <div className="space-y-2">
              {currentSubject.topics.map(t => (
                <button
                  key={t.topic}
                  onClick={() => setSelectedTopic(t.topic)}
                  className="w-full lingo-card p-4 text-left hover:-translate-y-0.5 transition-transform"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-extrabold text-gray-900">{t.topic}</p>
                      <p className="text-xs text-gray-500 mt-0.5 font-semibold">{t.subtopics.length} subtopics · {t.subtopics.reduce((s, st) => s + st.total, 0)} questions</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-lingo-green" />
                  </div>
                </button>
              ))}
              {/* Direct practice on all topics */}
              <div className="pt-2">
                <button
                  onClick={async () => {
                    setStarting(true);
                    try {
                      const res = await api.post('/practice/start', {
                        subject: selectedSubject,
                        count: 10, timed: true, duration_minutes: 15
                      });
                      navigate(`/test/${res.data.test.id}`);
                    } catch (err: any) {
                      alert(err.response?.data?.error || 'Failed');
                    } finally { setStarting(false); }
                  }}
                  disabled={starting}
                  className="w-full lingo-btn lingo-btn-green disabled:opacity-50 whitespace-normal leading-tight"
                >
                  {starting ? 'Starting...' : `Quick Practice — ${selectedSubject}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Configure Practice */}
        {selectedSubject && selectedTopic && currentTopic && (
          <div>
            <button onClick={() => setSelectedTopic('')} className="text-sm text-lingo-blue font-extrabold hover:underline mb-3">← {selectedSubject}</button>
            <h2 className="text-lg font-extrabold text-gray-900 mb-1">{selectedTopic}</h2>
            <p className="text-sm text-gray-500 font-semibold mb-4">{totalInTopic} questions across {currentTopic.subtopics.length} subtopics</p>

            {/* Subtopic filter */}
            <div className="lingo-card p-4 mb-4">
              <label className="block text-sm font-extrabold text-gray-700 mb-2">Subtopic (optional)</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSubtopic('')}
                  className={`px-3 py-1.5 rounded-xl text-sm border-2 ${selectClass(!selectedSubtopic)}`}
                >
                  All
                </button>
                {currentTopic.subtopics.map(st => (
                  <button
                    key={st.subtopic}
                    onClick={() => setSelectedSubtopic(st.subtopic)}
                    className={`px-3 py-1.5 rounded-xl text-sm border-2 ${selectClass(selectedSubtopic === st.subtopic)}`}
                  >
                    {st.subtopic} ({st.total})
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty filter */}
            <div className="lingo-card p-4 mb-4">
              <label className="block text-sm font-extrabold text-gray-700 mb-2">Difficulty</label>
              <div className="flex gap-2">
                {['', 'easy', 'medium', 'hard'].map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`px-4 py-1.5 rounded-xl text-sm border-2 ${selectClass(difficulty === d)}`}
                  >
                    {d || 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Count & Timer */}
            <div className="lingo-card p-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-extrabold text-gray-700 mb-2">Questions</label>
                  <select
                    value={questionCount}
                    onChange={e => setQuestionCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 border-lingo-border rounded-xl text-sm font-semibold bg-white"
                  >
                    {[5, 10, 15, 20, 25, 30, 50].map(n => (
                      <option key={n} value={n} disabled={n > totalInTopic}>{n} (max {Math.min(n, totalInTopic)})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-extrabold text-gray-700 mb-2">Timer</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTimed(true)}
                      className={`flex-1 py-2 rounded-xl text-sm border-2 ${selectClass(timed)}`}
                    >
                      Timed
                    </button>
                    <button
                      onClick={() => setTimed(false)}
                      className={`flex-1 py-2 rounded-xl text-sm border-2 ${selectClass(!timed)}`}
                    >
                      Untimed
                    </button>
                  </div>
                  {timed && (
                    <select
                      value={duration}
                      onChange={e => setDuration(Number(e.target.value))}
                      className="w-full mt-2 px-3 py-2 border-2 border-lingo-border rounded-xl text-sm font-semibold bg-white"
                    >
                      {[5, 10, 15, 20, 30, 45, 60].map(m => (
                        <option key={m} value={m}>{m} min</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={starting}
              className="w-full lingo-btn lingo-btn-green disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {starting ? (
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              ) : (
                <Play className="h-4 w-4" />
              )}
              {starting ? 'Starting...' : `Start Practice (${Math.min(questionCount, totalInTopic)} questions)`}
            </button>
          </div>
        )}
      </div>

      <MobileNav />
    </div>
  );
};

export default TopicPractice;
