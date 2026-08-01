import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Test, Question, Attempt } from '../types';
import api from '../utils/api';
import { Clock, ChevronLeft, ChevronRight, Flag } from 'lucide-react';

const TestTaking: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const [test, setTest] = useState<Test | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<'a' | 'b' | 'c' | 'd' | 'e' | null>(null);
  const [markedForReview, setMarkedForReview] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<Record<number, { selected: string; marked: boolean }>>({});
  const questionStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTest();
  }, [testId]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleSubmitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  const isUntimed = timeLeft === 0 && !loading;

  const startTest = async () => {
    try {
      const response = await api.post('/attempts/start', { test_id: Number(testId) });
      setAttempt(response.data.attempt);
      setTest(response.data.test);
      setQuestions(response.data.questions);
      setTimeLeft(response.data.test.duration_minutes * 60);
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to start test:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    }
  };

  const saveCurrentResponse = async () => {
    if (!attempt || !selectedOption) return;

    const timeSpent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000);

    try {
      await api.post('/attempts/response', {
        attempt_id: attempt.id,
        question_id: questions[currentQuestionIndex].id,
        selected_option: selectedOption,
        time_spent_seconds: timeSpent,
        marked_for_review: markedForReview
      });

      setResponses(prev => ({
        ...prev,
        [questions[currentQuestionIndex].id]: {
          selected: selectedOption,
          marked: markedForReview
        }
      }));
    } catch (error) {
      console.error('Failed to save response:', error);
    }
  };

  const handleOptionSelect = (option: 'a' | 'b' | 'c' | 'd' | 'e') => {
    setSelectedOption(option);
  };

  const handleNext = async () => {
    await saveCurrentResponse();
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      loadQuestionState(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = async () => {
    await saveCurrentResponse();
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      loadQuestionState(currentQuestionIndex - 1);
    }
  };

  const handleQuestionJump = async (index: number) => {
    await saveCurrentResponse();
    setCurrentQuestionIndex(index);
    loadQuestionState(index);
  };

  const loadQuestionState = (index: number) => {
    const question = questions[index];
    const saved = responses[question.id];
    setSelectedOption((saved?.selected as 'a' | 'b' | 'c' | 'd') || null);
    setMarkedForReview(saved?.marked || false);
    questionStartTimeRef.current = Date.now();
  };

  const handleSubmitTest = async () => {
    if (!attempt) return;
    
    await saveCurrentResponse();
    
    try {
      await api.post('/attempts/submit', { attempt_id: attempt.id });
      navigate(`/results/${attempt.id}`);
    } catch (error) {
      console.error('Failed to submit test:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading test...</p>
        </div>
      </div>
    );
  }

  if (!test || !questions.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Test not found</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-semibold text-gray-900">{test.title}</h1>
            </div>
            <div className="flex items-center space-x-4">
              {!isUntimed && (
                <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                  timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  <Clock className="h-5 w-5" />
                  <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <span className="text-sm text-gray-500">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <button
                  onClick={() => setMarkedForReview(!markedForReview)}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm ${
                    markedForReview ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Flag className="h-4 w-4" />
                  <span>{markedForReview ? 'Marked' : 'Mark for Review'}</span>
                </button>
              </div>

              <div className="mb-6">
                {currentQuestion.set_stimulus && (
                  <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <p className="text-[11px] font-semibold text-indigo-600 uppercase mb-2">
                      {currentQuestion.set_title || 'Shared Information'}
                    </p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap font-mono">{currentQuestion.set_stimulus}</p>
                  </div>
                )}
                <p className="text-lg text-gray-900 whitespace-pre-wrap">{currentQuestion.question_text}</p>
              </div>

              <div className="space-y-3">
                {['a', 'b', 'c', 'd', 'e'].map((option) => (
                  <button
                    key={option}
                    onClick={() => handleOptionSelect(option as 'a' | 'b' | 'c' | 'd' | 'e')}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedOption === option
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="font-semibold text-gray-700">{option.toUpperCase()}.</span>
                      <span className="text-gray-900">
                        {currentQuestion[`option_${option}` as keyof Question] as string}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex justify-between mt-6">
                <button
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                >
                  <ChevronLeft className="h-5 w-5" />
                  <span>Previous</span>
                </button>

                {currentQuestionIndex === questions.length - 1 ? (
                  <button
                    onClick={handleSubmitTest}
                    className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                  >
                    Submit Test
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4">Question Navigator</h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((_, index) => {
                  const saved = responses[questions[index].id];
                  const isAnswered = !!saved?.selected;
                  const isMarked = saved?.marked;

                  return (
                    <button
                      key={index}
                      onClick={() => handleQuestionJump(index)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                        currentQuestionIndex === index
                          ? 'bg-blue-600 text-white'
                          : isMarked
                          ? 'bg-yellow-400 text-yellow-900'
                          : isAnswered
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-100 rounded"></div>
                  <span className="text-gray-600">Answered</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-yellow-400 rounded"></div>
                  <span className="text-gray-600">Marked for Review</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-100 rounded"></div>
                  <span className="text-gray-600">Not Answered</span>
                </div>
              </div>

              <button
                onClick={handleSubmitTest}
                className="w-full mt-6 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
              >
                Submit Test
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestTaking;
