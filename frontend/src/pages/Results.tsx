import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Attempt, Test, QuestionResponse } from '../types';
import api from '../utils/api';
import MobileNav from '../components/MobileNav';
import PageHeader from '../components/PageHeader';
import InsightPanel from '../components/InsightPanel';
import { generateTestInsights } from '../utils/insightEngine';
import { CheckCircle, XCircle, TrendingUp, ListChecks } from 'lucide-react';

const Results: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [score, setScore] = useState({ total: 0, correct: 0, attempted: 0, accuracy: 0 });
  const [previousBest, setPreviousBest] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMistakes, setShowMistakes] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    fetchResults();
  }, [attemptId]);

  const fetchResults = async () => {
    try {
      const response = await api.get(`/attempts/${attemptId}/results`);
      const attemptData = response.data.attempt;
      const responsesData = response.data.responses;
      setAttempt(attemptData);
      setTest(response.data.test);
      setResponses(responsesData);

      const correct = responsesData.filter((r: any) => r.is_correct).length;
      const attempted = responsesData.filter((r: any) => r.selected_option).length;
      setScore({
        total: attemptData.total_score || 0,
        correct,
        attempted,
        accuracy: attempted > 0 ? parseFloat(((correct / attempted) * 100).toFixed(2)) : 0
      });

      try {
        const hRes = await api.get('/attempts/my-history');
        const entry = hRes.data.find((x: any) => x.test_id === attemptData.test_id);
        if (entry) {
          const others = entry.attempts.filter(
            (a: any) => a.attempt_id !== attemptData.id && a.status === 'completed' && a.total_score != null
          );
          setPreviousBest(others.length ? Math.max(...others.map((a: any) => a.total_score)) : null);
        }
      } catch (e) {
        setPreviousBest(null);
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateErrorTag = async (responseId: number, errorTag: string) => {
    try {
      await api.put('/attempts/error-tag', { response_id: responseId, error_tag: errorTag });
      setResponses(prev => prev.map(r => 
        r.id === responseId ? { ...r, error_tag: errorTag as any } : r
      ));
    } catch (error) {
      console.error('Failed to update error tag:', error);
    }
  };

  const handleRetryMistakes = async () => {
    setRetrying(true);
    try {
      const res = await api.post('/practice/retry-mistakes', { attempt_id: Number(attemptId) });
      navigate(`/test/${res.data.test.id}`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Could not start retry session');
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lingo-bg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-lingo-border border-t-lingo-green"></div>
          <p className="mt-4 text-gray-600 font-bold">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!attempt || !test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lingo-bg">
        <div className="text-center">
          <p className="text-gray-600 font-bold">Results not found</p>
        </div>
      </div>
    );
  }

  const insights = generateTestInsights(responses, score, test, previousBest);

  const wrongCount = responses.filter(r => !r.is_correct && r.selected_option).length;
  const displayed = showMistakes
    ? responses.filter(r => !r.is_correct && r.selected_option)
    : responses;

  return (
    <div className="min-h-screen bg-lingo-bg">
      <PageHeader title="Test Results" onBack={() => navigate('/dashboard')} />

      <div className="max-w-lg mx-auto px-4 pt-6 pb-nav">
        <div className="mb-6">
          <h1 className="text-xl font-extrabold text-gray-900">{test.title}</h1>
          <p className="text-gray-600 mt-0.5 text-sm font-semibold">Test Results</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="lingo-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-bold">Score</p>
                <p className="text-2xl font-extrabold text-gray-900">{score.total.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-7 w-7 text-lingo-blue" />
            </div>
          </div>

          <div className="lingo-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-bold">Correct</p>
                <p className="text-2xl font-extrabold text-lingo-green-dark">{score.correct}</p>
              </div>
              <CheckCircle className="h-7 w-7 text-lingo-green" />
            </div>
          </div>

          <div className="lingo-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-bold">Attempted</p>
                <p className="text-2xl font-extrabold text-gray-900">{score.attempted}</p>
              </div>
              <ListChecks className="h-7 w-7 text-lingo-blue" />
            </div>
          </div>

          <div className="lingo-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-bold">Accuracy</p>
                <p className="text-2xl font-extrabold text-lingo-blue-dark">{score.accuracy}%</p>
              </div>
              <div className="h-7 w-7 bg-lingo-blue/15 rounded-full flex items-center justify-center">
                <span className="text-lingo-blue-dark font-extrabold">%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <InsightPanel title="AI Insights" insights={insights} />
        </div>

        <div className="lingo-card overflow-hidden">
          <div className="p-6 border-b-2 border-lingo-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold text-gray-900">Question-wise Analysis</h2>
              <div className="flex items-center gap-2">
                {wrongCount > 0 && (
                  <>
                    <button
                      onClick={() => setShowMistakes(!showMistakes)}
                      className={`text-xs px-3 py-1.5 rounded-xl border-2 font-bold transition-colors ${
                        showMistakes
                          ? 'bg-lingo-red/15 text-lingo-red border-lingo-red'
                          : 'bg-lingo-blue/15 text-lingo-blue-dark border-lingo-blue'
                      }`}
                    >
                      {showMistakes ? 'Mistakes only' : 'All questions'}
                    </button>
                    <button
                      onClick={handleRetryMistakes}
                      disabled={retrying}
                      className="px-3 py-1.5 bg-lingo-green text-white text-xs rounded-xl font-bold border-b-4 border-lingo-green-dark hover:bg-lingo-green-dark active:scale-[0.97] disabled:opacity-50 whitespace-nowrap"
                    >
                      {retrying ? 'Starting...' : 'Retry Mistakes'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="p-3 border-b-2 border-lingo-border bg-lingo-bg/50 flex items-center justify-between text-xs text-gray-500 font-bold">
            <span>{showMistakes ? `Mistakes (${displayed.length})` : `All Questions (${displayed.length})`}</span>
            <span>{wrongCount} wrong answers</span>
          </div>

          <div className="divide-y divide-lingo-border">
            {displayed.map((response, index) => (
              <div key={response.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-bold text-gray-500">Q{index + 1}</span>
                    {response.is_correct ? (
                      <CheckCircle className="h-5 w-5 text-lingo-green" />
                    ) : (
                      <XCircle className="h-5 w-5 text-lingo-red" />
                    )
                    }
                  </div>
                  <div className="flex items-center space-x-4">
                    {response.time_spent_seconds && (
                      <span className="text-sm text-gray-600 font-semibold">
                        {Math.floor(response.time_spent_seconds / 60)}m {response.time_spent_seconds % 60}s
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs font-bold rounded-xl uppercase ${
                      response.difficulty === 'easy' ? 'bg-lingo-green/15 text-lingo-green-dark' :
                      response.difficulty === 'medium' ? 'bg-lingo-blue/15 text-lingo-blue-dark' :
                      'bg-lingo-red/15 text-lingo-red'
                    }`}>
                      {response.difficulty}
                    </span>
                  </div>
                </div>

                {response.set_stimulus && (
                  <div className="mb-4 p-4 bg-lingo-blue/10 border-2 border-lingo-blue rounded-xl">
                    <p className="text-[11px] font-bold text-lingo-blue-dark uppercase mb-2">
                      {response.set_title || 'Shared Information'}
                    </p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap font-mono font-medium">{response.set_stimulus}</p>
                  </div>
                )}
                <p className="text-gray-900 mb-4 whitespace-pre-wrap font-bold">{response.question_text}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                  {(['a', 'b', 'c', 'd', 'e'] as const)
                    .filter(option => (response[`option_${option}`] as string)?.trim())
                    .map((option) => {
                    const isSelected = response.selected_option === option;
                    const isCorrect = response.correct_option === option;

                    return (
                      <div
                        key={option}
                        className={`p-3 rounded-xl border-2 ${
                          isCorrect
                            ? 'border-lingo-green bg-lingo-green/10'
                            : isSelected && !isCorrect
                            ? 'border-lingo-red bg-lingo-red/10'
                            : 'border-lingo-border bg-white'
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          <span className="font-extrabold text-gray-700">{option.toUpperCase()}.</span>
                          <span className="text-gray-900 font-medium">
                            {response[`option_${option}`] as string}
                          </span>
                          {isCorrect && <span className="ml-auto text-lingo-green text-sm font-bold">✓ Correct</span>}
                          {isSelected && !isCorrect && <span className="ml-auto text-lingo-red text-sm font-bold">✗ Your answer</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {response.explanation && (
                  <div className="bg-lingo-blue/10 border-2 border-lingo-blue rounded-xl p-4 mb-4">
                    <h4 className="font-extrabold text-lingo-blue-dark mb-2">Explanation</h4>
                    <p className="text-lingo-blue-dark text-sm font-medium">{response.explanation}</p>
                  </div>
                )}

                {!response.is_correct && response.selected_option && (
                  <div className="mt-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Why did you get this wrong?
                    </label>
                    <select
                      value={response.error_tag || ''}
                      onChange={(e) => handleUpdateErrorTag(response.id, e.target.value)}
                      className="w-full max-w-xs px-3 py-2 border-2 border-lingo-border rounded-xl focus:outline-none focus:ring-2 focus:ring-lingo-blue bg-white font-semibold"
                    >
                      <option value="">Select a reason...</option>
                      <option value="concept_gap">Concept Gap</option>
                      <option value="silly_mistake">Silly Mistake</option>
                      <option value="guessed">Guessed</option>
                      <option value="time_out">Ran out of time</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <MobileNav />
    </div>
  );
};

export default Results;
