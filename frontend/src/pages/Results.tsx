import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Attempt, Test, QuestionResponse } from '../types';
import api from '../utils/api';
import MobileNav from '../components/MobileNav';
import { CheckCircle, XCircle, ArrowLeft, TrendingUp } from 'lucide-react';

const Results: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [score, setScore] = useState({ total: 0, correct: 0, attempted: 0, accuracy: 0 });
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!attempt || !test) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Results not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex justify-between h-14 items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 touch-target"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6 pb-nav">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">{test.title}</h1>
          <p className="text-gray-600 mt-0.5 text-sm">Test Results</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Score</p>
                <p className="text-2xl font-bold text-gray-900">{score.total.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-7 w-7 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Correct</p>
                <p className="text-2xl font-bold text-green-600">{score.correct}</p>
              </div>
              <CheckCircle className="h-7 w-7 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Attempted</p>
                <p className="text-2xl font-bold text-gray-900">{score.attempted}</p>
              </div>
              <div className="h-7 w-7 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-semibold">{score.attempted}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Accuracy</p>
                <p className="text-2xl font-bold text-purple-600">{score.accuracy}%</p>
              </div>
              <div className="h-7 w-7 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-semibold">%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Question-wise Analysis</h2>
          </div>

          <div className="divide-y">
            {responses.map((response, index) => (
              <div key={response.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-500">Q{index + 1}</span>
                    {response.is_correct ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )
                    }
                  </div>
                  <div className="flex items-center space-x-4">
                    {response.time_spent_seconds && (
                      <span className="text-sm text-gray-600">
                        {Math.floor(response.time_spent_seconds / 60)}m {response.time_spent_seconds % 60}s
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      response.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                      response.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {response.difficulty}
                    </span>
                  </div>
                </div>

                {response.set_stimulus && (
                  <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <p className="text-[11px] font-semibold text-indigo-600 uppercase mb-2">
                      {response.set_title || 'Shared Information'}
                    </p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap font-mono">{response.set_stimulus}</p>
                  </div>
                )}
                <p className="text-gray-900 mb-4 whitespace-pre-wrap">{response.question_text}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                  {['a', 'b', 'c', 'd', 'e'].map((option) => {
                    const isSelected = response.selected_option === option;
                    const isCorrect = response.correct_option === option;

                    return (
                      <div
                        key={option}
                        className={`p-3 rounded-lg border-2 ${
                          isCorrect
                            ? 'border-green-500 bg-green-50'
                            : isSelected && !isCorrect
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          <span className="font-semibold text-gray-700">{option.toUpperCase()}.</span>
                          <span className="text-gray-900">
                            {response[`option_${option}` as keyof QuestionResponse] as string}
                          </span>
                          {isCorrect && <span className="ml-auto text-green-600 text-sm">✓ Correct</span>}
                          {isSelected && !isCorrect && <span className="ml-auto text-red-600 text-sm">✗ Your answer</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {response.explanation && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-blue-900 mb-2">Explanation</h4>
                    <p className="text-blue-800 text-sm">{response.explanation}</p>
                  </div>
                )}

                {!response.is_correct && response.selected_option && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Why did you get this wrong?
                    </label>
                    <select
                      value={response.error_tag || ''}
                      onChange={(e) => handleUpdateErrorTag(response.id, e.target.value)}
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
