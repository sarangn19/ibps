import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Test, Question, Attempt, PreTestRefresher } from '../types';
import api from '../utils/api';
import PageHeader from '../components/PageHeader';
import { Clock, ChevronLeft, ChevronRight, Flag, Grid3X3, AlertTriangle, BookOpenCheck } from 'lucide-react';

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
  const [refresher, setRefresher] = useState<PreTestRefresher | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());
  const timedRef = useRef(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.get(`/revision/pre-test/${testId}`);
        const data = res.data;
        if (data.in_progress || data.refresher.length === 0) {
          startTest();
        } else {
          setRefresher(data);
          setLoading(false);
        }
      } catch (e) {
        startTest();
      }
    };
    init();
  }, [testId]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : prev));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  useEffect(() => {
    if (timedRef.current && !submittedRef.current && timeLeft === 0 && attempt && !loading) {
      handleSubmitTest();
    }
  }, [timeLeft, loading, attempt]);

  const isUntimed = timeLeft === 0 && !loading;

  const startTest = async () => {
    try {
      const response = await api.post('/attempts/start', { test_id: Number(testId) });
      setAttempt(response.data.attempt);
      setTest(response.data.test);
      setQuestions(response.data.questions);
      timedRef.current = response.data.test.duration_minutes > 0;
      submittedRef.current = false;
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
    if (!attempt || submittedRef.current) return;
    submittedRef.current = true;

    await saveCurrentResponse();

    try {
      await api.post('/attempts/submit', { attempt_id: attempt.id });
      navigate(`/results/${attempt.id}`);
    } catch (error) {
      console.error('Failed to submit test:', error);
      submittedRef.current = false;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lingo-bg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-lingo-border border-t-lingo-green"></div>
          <p className="mt-4 text-gray-600 font-bold">Loading test...</p>
        </div>
      </div>
    );
  }

  if (refresher && !attempt) {
    const startAnyway = () => {
      setRefresher(null);
      startTest();
    };
    return (
      <div className="min-h-screen bg-lingo-bg">
        <PageHeader title="Refresh Concepts First" onBack={() => navigate('/dashboard')} />
        <div className="max-w-lg mx-auto px-4 pt-5 pb-16">
          <div className="lingo-card p-5 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lingo-red/15 text-lingo-red shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </span>
              <div>
                <h2 className="font-extrabold text-gray-900 leading-tight">Your accuracy is below 60% on these topics</h2>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">A quick refresher now will boost your score in this test.</p>
              </div>
            </div>

            <div className="space-y-2">
              {refresher.refresher.map(t => (
                <div key={`${t.subject}|${t.topic}|${t.subtopic || ''}`} className="flex flex-wrap items-center justify-between gap-2 border-2 border-lingo-border rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{t.topic}{t.subtopic ? ` · ${t.subtopic}` : ''}</p>
                    <p className="text-xs text-gray-500">
                      {t.accuracy_rolling !== null ? `${Math.round(t.accuracy_rolling)}% accuracy` : t.classification} · {t.available} questions available
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const p = new URLSearchParams({ subject: t.subject, topic: t.topic });
                      if (t.subtopic) p.set('subtopic', t.subtopic);
                      navigate(`/practice/start?${p.toString()}`);
                    }}
                    className="shrink-0 px-3 py-1.5 bg-lingo-blue text-white text-xs rounded-xl font-bold hover:bg-lingo-blue-dark whitespace-nowrap"
                  >
                    Practice First
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={startAnyway}
              className="w-full mt-4 px-4 py-2 bg-lingo-blue text-white text-sm rounded-xl font-bold border-b-4 border-lingo-blue-dark hover:bg-lingo-blue-dark active:scale-[0.97]"
            >
              Start Test Anyway
            </button>
            <p className="text-xs text-gray-500 text-center mt-3 flex items-center justify-center gap-1">
              <BookOpenCheck className="h-3.5 w-3.5" /> You can also skip straight to the test if you prefer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!test || !questions.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lingo-bg">
        <div className="text-center">
          <p className="text-gray-600 font-bold">Test not found</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  const navigatorPanel = (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-extrabold text-gray-900">Question Navigator</h3>
        <button
          onClick={() => setShowNavigator(false)}
          className="touch-target flex items-center justify-center h-9 w-9 rounded-xl bg-lingo-bg text-gray-600"
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
              className={`touch-target h-11 rounded-xl text-sm font-bold transition-all ${
                currentQuestionIndex === index
                  ? 'bg-lingo-blue text-white'
                  : isMarked
                  ? 'bg-lingo-bg text-gray-500 border-2 border-lingo-border'
                  : isAnswered
                  ? 'bg-lingo-green/15 text-lingo-green-dark'
                  : 'bg-lingo-bg text-gray-700 border-2 border-lingo-border hover:border-lingo-blue'
              }`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2 text-xs font-semibold">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-lingo-green/15 rounded border-2 border-lingo-green"></div>
          <span className="text-gray-600">Answered</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-lingo-bg rounded border-2 border-lingo-border"></div>
          <span className="text-gray-600">Marked for Review</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-lingo-bg rounded border-2 border-lingo-border"></div>
          <span className="text-gray-600">Not Answered</span>
        </div>
      </div>

      <button
        onClick={handleSubmitTest}
        className="w-full mt-6 lingo-btn lingo-btn-blue"
      >
        Submit Test
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-lingo-bg">
      <PageHeader
        title={test.title}
        onBack={() => navigate('/dashboard')}
        right={
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowNavigator(true)}
              className="touch-target flex items-center gap-1 px-3 py-1.5 rounded-xl bg-lingo-bg text-gray-700 font-bold border-2 border-lingo-border"
            >
              <Grid3X3 className="h-4 w-4" />
              <span className="text-sm hidden sm:inline">Questions</span>
            </button>
            {!isUntimed && (
              <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold border-2 ${
                timeLeft < 300 ? 'bg-lingo-red/10 text-lingo-red border-lingo-red' : 'bg-lingo-blue/15 text-lingo-blue-dark border-lingo-blue'
              }`}>
                <Clock className="h-4 w-4" />
                <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
              </div>
            )}
          </div>
        }
      />

      <div className="max-w-lg mx-auto px-4 pt-4 pb-nav">
        <div className="lingo-card p-4 sm:p-6">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm text-gray-500 font-bold">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <button
              onClick={() => setMarkedForReview(!markedForReview)}
              className={`touch-target flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-bold border-2 ${
                markedForReview ? 'bg-lingo-blue/10 text-lingo-blue-dark border-lingo-blue' : 'bg-lingo-bg text-gray-600 border-lingo-border'
              }`}
            >
              <Flag className="h-4 w-4" />
              <span>{markedForReview ? 'Marked' : 'Mark for Review'}</span>
            </button>
          </div>

          <div className="mb-6">
            {currentQuestion.set_stimulus && (
              <div className="mb-4 p-4 bg-lingo-blue/10 border-2 border-lingo-blue rounded-xl">
                <p className="text-[11px] font-bold text-lingo-blue-dark uppercase mb-2">
                  {currentQuestion.set_title || 'Shared Information'}
                </p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap font-mono font-medium">{currentQuestion.set_stimulus}</p>
              </div>
            )}
            <p className="text-base sm:text-lg text-gray-900 whitespace-pre-wrap font-bold">{currentQuestion.question_text}</p>
          </div>

          <div className="space-y-2.5">
            {(['a', 'b', 'c', 'd', 'e'] as const)
              .filter(option => (currentQuestion[`option_${option}`] as string)?.trim())
              .map((option) => (
                <button
                  key={option}
                  onClick={() => handleOptionSelect(option)}
                  className={`w-full text-left p-4 rounded-xl border-2 touch-target transition-all ${
                    selectedOption === option
                      ? 'border-lingo-blue bg-lingo-blue/10'
                      : 'border-lingo-border bg-white hover:border-lingo-blue'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <span className="font-extrabold text-lingo-blue-dark">{option.toUpperCase()}.</span>
                    <span className="text-gray-900 text-sm sm:text-base font-medium">
                      {currentQuestion[`option_${option}`] as string}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-lingo-border pb-safe">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="touch-target flex items-center gap-1 px-4 py-2.5 rounded-xl bg-lingo-bg text-gray-700 hover:bg-lingo-border disabled:opacity-40 text-sm font-extrabold border-b-4 border-lingo-border"
          >
            <ChevronLeft className="h-5 w-5" />
            <span>Prev</span>
          </button>

          <button
            onClick={() => setShowNavigator(true)}
            className="touch-target flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-lingo-blue/10 text-lingo-blue-dark text-sm font-extrabold border-b-4 border-lingo-blue/30"
          >
            <Grid3X3 className="h-4 w-4" />
            <span>{Object.keys(responses).length} answered</span>
          </button>

          {currentQuestionIndex === questions.length - 1 ? (
            <button
              onClick={handleSubmitTest}
              className="touch-target px-5 py-2.5 rounded-xl bg-lingo-blue text-white hover:bg-lingo-blue-dark text-sm font-extrabold border-b-4 border-lingo-blue-dark"
            >
              Submit
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="touch-target flex items-center gap-1 px-4 py-2.5 rounded-xl bg-lingo-blue text-white hover:bg-lingo-blue-dark text-sm font-extrabold border-b-4 border-lingo-blue-dark"
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
          <div className="relative w-full lg:w-96 bg-white rounded-t-2xl lg:rounded-2xl shadow-xl p-5 max-h-[80vh] overflow-y-auto pb-safe border-2 border-lingo-border">
            {navigatorPanel}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestTaking;
