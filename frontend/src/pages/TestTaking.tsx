import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Test, Question, Attempt } from '../types';
import api from '../utils/api';
import { Clock, ChevronLeft, ChevronRight, Flag, Grid3X3 } from 'lucide-react';

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
  const [showNavigator, setShowNavigator] = useState(false);
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
    setShowNavigator(false);
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

  const navigatorPanel = (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Question Navigator</h3>
        <button
          onClick={() => setShowNavigator(false)}
          className="touch-target flex items-center justify-center h-9 w-9 rounded-lg bg-gray-100 text-gray-600"
          aria-label="Close navigator"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {questions.map((_, index) => {
          const saved = responses[questions[index].id];
          const isAnswered = !!saved?.selected;
          const isMarked = saved?.marked;

          return (
            <button
              key={index}
              onClick={() => handleQuestionJump(index)}
              className={`touch-target h-11 rounded-lg text-sm font-medium transition-all ${
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
        className="w-full mt-6 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 font-medium touch-target"
      >
        Submit Test
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex justify-between h-14 items-center gap-2">
            <h1 className="text-base font-semibold text-gray-900 truncate">{test.title}</h1>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowNavigator(true)}
                className="touch-target flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700"
              >
                <Grid3X3 className="h-4 w-4" />
                <span className="text-sm hidden sm:inline">Questions</span>
              </button>
              {!isUntimed && (
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg ${
                  timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  <Clock className="h-4 w-4" />
                  <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-4 pb-nav">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm text-gray-500">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <button
              onClick={() => setMarkedForReview(!markedForReview)}
              className={`touch-target flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
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
            <p className="text-base sm:text-lg text-gray-900 whitespace-pre-wrap">{currentQuestion.question_text}</p>
          </div>

          <div className="space-y-2.5">
            {['a', 'b', 'c', 'd', 'e'].map((option) => (
              <button
                key={option}
                onClick={() => handleOptionSelect(option as 'a' | 'b' | 'c' | 'd' | 'e')}
                className={`w-full text-left p-4 rounded-xl border-2 touch-target transition-all ${
                  selectedOption === option
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <span className="font-semibold text-gray-700">{option.toUpperCase()}.</span>
                  <span className="text-gray-900 text-sm sm:text-base">
                    {currentQuestion[`option_${option}` as keyof Question] as string}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 pb-safe">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="touch-target flex items-center gap-1 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 text-sm font-medium"
          >
            <ChevronLeft className="h-5 w-5" />
            <span>Prev</span>
          </button>

          <button
            onClick={() => setShowNavigator(true)}
            className="touch-target flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-medium"
          >
            <Grid3X3 className="h-4 w-4" />
            <span>{Object.keys(responses).length} answered</span>
          </button>

          {currentQuestionIndex === questions.length - 1 ? (
            <button
              onClick={handleSubmitTest}
              className="touch-target px-5 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-medium"
            >
              Submit
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="touch-target flex items-center gap-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
            >
              <span>Next</span>
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigator bottom sheet (mobile) / sidebar (desktop) */}
      {showNavigator && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowNavigator(false)}
          />
          <div className="relative w-full lg:w-96 bg-white rounded-t-2xl lg:rounded-2xl shadow-xl p-5 max-h-[80vh] overflow-y-auto pb-safe">
            {navigatorPanel}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestTaking;
