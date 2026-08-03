import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Newspaper, BookOpen, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import api from '../utils/api';
import MobileNav from '../components/MobileNav';
import PageHeader from '../components/PageHeader';
import { CaArticle, CaQuizQuestion } from '../types';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'business', label: 'Business' },
  { value: 'politics', label: 'Politics' },
  { value: 'science', label: 'Science' },
  { value: 'technology', label: 'Technology' },
  { value: 'education', label: 'Education' },
  { value: 'world', label: 'World' },
  { value: 'health', label: 'Health' }
];

const CurrentAffairs: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'read' | 'quiz'>('read');
  const [category, setCategory] = useState('');
  const [articles, setArticles] = useState<CaArticle[]>([]);
  const [quiz, setQuiz] = useState<CaQuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<CaArticle | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showExplanations, setShowExplanations] = useState(false);

  useEffect(() => {
    setLoading(true);
    if (mode === 'read') {
      const params = new URLSearchParams({ limit: '50' });
      if (category) params.set('category', category);
      api.get(`/ca/feed?${params.toString()}`)
        .then(res => setArticles(res.data.articles || []))
        .catch(() => setArticles([]))
        .finally(() => setLoading(false));
    } else {
      const params = new URLSearchParams({ limit: '15' });
      if (category) params.set('category', category);
      api.get(`/ca/quiz?${params.toString()}`)
        .then(res => setQuiz(res.data.questions || []))
        .catch(() => setQuiz([]))
        .finally(() => setLoading(false));
      setAnswers({});
      setShowExplanations(false);
    }
  }, [mode, category]);

  const score = useMemo(() => {
    let s = 0;
    for (const q of quiz) if (answers[q.id] && answers[q.id] === q.correct_option) s++;
    return s;
  }, [quiz, answers]);

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-lingo-bg">
      <PageHeader
        title="Current Affairs"
        onBack={() => navigate('/dashboard')}
        right={<Newspaper className="h-5 w-5 text-lingo-green" />}
      />

      <div className="max-w-lg mx-auto px-4 pt-5 pb-nav space-y-4">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 bg-white rounded-2xl border-2 border-lingo-border p-1">
          <button
            onClick={() => setMode('read')}
            className={`touch-target flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-colors ${
              mode === 'read' ? 'bg-lingo-green text-white' : 'text-gray-600 hover:bg-lingo-bg'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Read
          </button>
          <button
            onClick={() => setMode('quiz')}
            className={`touch-target flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-colors ${
              mode === 'quiz' ? 'bg-lingo-green text-white' : 'text-gray-600 hover:bg-lingo-bg'
            }`}
          >
            <Newspaper className="h-4 w-4" />
            Quiz
          </button>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold touch-target border-2 ${
                category === c.value ? 'bg-lingo-green border-lingo-green text-white' : 'bg-white border-lingo-border text-gray-600 hover:border-lingo-green'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Quiz score banner */}
        {mode === 'quiz' && answeredCount > 0 && answeredCount === quiz.length && quiz.length > 0 && (
          <div className="lingo-card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-extrabold text-gray-900">Your Score</p>
              <p className="text-xs text-gray-500 font-semibold">{answeredCount} answered</p>
            </div>
            <div className="text-2xl font-extrabold text-lingo-green">{score}/{quiz.length}</div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-lingo-border border-t-lingo-green"></div>
          </div>
        ) : mode === 'read' ? (
          selectedArticle ? (
            <div className="lingo-card overflow-hidden">
              <div className="p-5">
                <span className="inline-block px-2 py-0.5 bg-lingo-green/15 text-lingo-green-dark rounded-xl text-xs font-bold uppercase mb-3">
                  {selectedArticle.category}
                </span>
                <h2 className="text-lg font-extrabold text-gray-900 leading-snug">{selectedArticle.title}</h2>
                {selectedArticle.pub_date && (
                  <p className="text-xs text-gray-500 mt-2 font-semibold">{new Date(selectedArticle.pub_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                )}
              </div>
              {selectedArticle.description && (
                <div className="px-5 pb-5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedArticle.description}
                </div>
              )}
              <div className="px-5 pb-5 flex items-center justify-between">
                <p className="text-xs text-gray-500 font-semibold">{selectedArticle.source}</p>
                {selectedArticle.link && (
                  <a
                    href={selectedArticle.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-lingo-blue font-extrabold touch-target"
                  >
                    Read full <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <div className="px-5 pb-5">
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="w-full lingo-btn lingo-btn-ghost"
                >
                  Back to list
                </button>
              </div>
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-16 lingo-card">
              <Newspaper className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500 font-semibold">No articles found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {articles.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedArticle(a)}
                  className="w-full text-left lingo-card p-4 hover:-translate-y-0.5 transition-transform touch-target"
                >
                  <span className="inline-block px-2 py-0.5 bg-lingo-green/15 text-lingo-green-dark rounded-xl text-xs font-bold uppercase mb-2">
                    {a.category}
                  </span>
                  <h3 className="text-sm font-extrabold text-gray-900 leading-snug">{a.title}</h3>
                  {a.description && (
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 font-medium">{a.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-400 font-semibold">{a.source}</p>
                    {a.pub_date && (
                      <p className="text-xs text-gray-400 font-semibold">{new Date(a.pub_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : quiz.length === 0 ? (
          <div className="text-center py-16 lingo-card">
            <Newspaper className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500 font-semibold">No quiz questions yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {quiz.map((q, idx) => {
              const selected = answers[q.id];
              const showCorrect = showExplanations && q.correct_option;
              return (
                <div key={q.id} className="lingo-card p-4">
                  <p className="text-xs text-gray-400 font-bold mb-1">Question {idx + 1} · {q.category}</p>
                  <p className="text-sm font-extrabold text-gray-900 leading-snug">{q.question_text}</p>
                  <div className="mt-3 space-y-2">
                    {(['a', 'b', 'c', 'd', 'e'] as const).map(opt => {
                      const text = q[`option_${opt}`];
                      if (!text) return null;
                      const isSelected = selected === opt;
                      const isCorrect = showCorrect && opt === q.correct_option;
                      const isWrongPick = showCorrect && isSelected && opt !== q.correct_option;
                      return (
                        <button
                          key={opt}
                          onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                          className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl border-2 text-sm touch-target transition-colors ${
                            isCorrect
                              ? 'border-lingo-green bg-lingo-green/15 text-lingo-green-dark'
                              : isWrongPick
                                ? 'border-lingo-red bg-lingo-red/10 text-lingo-red'
                                : isSelected
                                  ? 'border-lingo-blue bg-lingo-blue/10 text-lingo-blue-dark'
                                  : 'border-lingo-border text-gray-700 hover:border-lingo-green'
                          }`}
                        >
                          <span className="shrink-0 w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold">
                            {opt.toUpperCase()}
                          </span>
                          <span className="leading-snug font-medium">{text}</span>
                          {isCorrect && <CheckCircle2 className="ml-auto shrink-0 h-4 w-4 text-lingo-green" />}
                          {isWrongPick && <XCircle className="ml-auto shrink-0 h-4 w-4 text-lingo-red" />}
                        </button>
                      );
                    })}
                  </div>
                  {showExplanations && q.explanation && (
                    <div className="mt-3 p-3 bg-lingo-bg rounded-xl text-xs text-gray-600 leading-relaxed font-medium">
                      <p className="font-extrabold text-gray-800 mb-1">Explanation</p>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
            <button
              onClick={() => setShowExplanations(v => !v)}
              disabled={answeredCount === 0}
              className={`w-full py-3 rounded-xl font-bold text-sm touch-target transition-colors ${
                answeredCount === 0 ? 'bg-lingo-border text-gray-400' : 'lingo-btn lingo-btn-blue'
              }`}
            >
              {showExplanations ? 'Hide Explanations' : `Show Answers (${answeredCount}/${quiz.length})`}
            </button>
          </div>
        )}
      </div>

      <MobileNav />
    </div>
  );
};

export default CurrentAffairs;
