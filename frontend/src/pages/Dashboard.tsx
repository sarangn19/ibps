import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Test, TestHistory, SubjectTree } from '../types';
import api from '../utils/api';
import ExpertiseMap from '../components/ExpertiseMap';
import { BookOpen, Clock, BarChart3, Award, TrendingUp, Target, Zap, Brain } from 'lucide-react';

interface Recommendation {
  subject: string;
  topic: string;
  subtopic: string;
  classification: string;
  reason?: string;
  available: number;
  scope: { subject: string; topic: string; subtopic: string | null };
  questions: any[];
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState<Test[]>([]);
  const [history, setHistory] = useState<Record<number, TestHistory>>({});
  const [subjects, setSubjects] = useState<SubjectTree[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchTests(), fetchHistory(), fetchSubjects(), fetchRecommendations()]).finally(() => setLoading(false));
  }, []);

  const fetchRecommendations = async () => {
    try {
      const res = await api.get('/mastery/recommendations');
      setRecommendations(res.data);
    } catch (e) { /* Phase 2 - ok if not ready */ }
  };

  const fetchTests = async () => {
    try {
      const response = await api.get('/tests');
      setTests(response.data);
    } catch (error) {
      console.error('Failed to fetch tests:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await api.get('/attempts/my-history');
      const map: Record<number, TestHistory> = {};
      for (const h of response.data) {
        map[h.test_id] = h;
      }
      setHistory(map);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await api.get('/questions/subjects/tree');
      setSubjects(response.data);
    } catch (error) {
      console.error('Failed to fetch subjects:', error);
    }
  };

  const handleStartTest = (testId: number) => {
    navigate(`/test/${testId}`);
  };

  const handleViewResults = (attemptId: number) => {
    navigate(`/results/${attemptId}`);
  };

  const handleStartPractice = (subject?: string, topic?: string, subtopic?: string) => {
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (topic) params.set('topic', topic);
    if (subtopic) params.set('subtopic', subtopic);
    navigate(`/practice/start?${params.toString()}`);
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'full_mock': return 'bg-purple-100 text-purple-800';
      case 'sectional': return 'bg-blue-100 text-blue-800';
      case 'topic_practice': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'full_mock': return 'Full Mock';
      case 'sectional': return 'Sectional';
      case 'topic_practice': return 'Topic Practice';
      default: return type;
    }
  };

  const stageColor = (stage: string) => stage === 'mains' ? 'bg-orange-100 text-orange-800' : 'bg-teal-100 text-teal-800';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            <h1 className="text-lg font-bold text-gray-900">IBPS Coaching</h1>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600 hidden sm:inline">{user?.name}</span>
              <button onClick={logout} className="text-sm text-red-600 hover:text-red-700">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

        {/* Practice Your Weak Areas */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-md p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Target className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Practice Your Weak Areas</h2>
              </div>
              <p className="text-blue-100 text-sm max-w-lg">
                Focus on the topics where you need the most improvement. Pick a subject below to drill down by topic.
              </p>
            </div>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">Phase 2 — Coming Soon</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {subjects.slice(0, 5).map(s => (
              <button
                key={s.subject}
                onClick={() => handleStartPractice(s.subject)}
                className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm transition-colors"
              >
                {s.subject}
              </button>
            ))}
          </div>
        </div>

        {/* Recommended for You */}
        {recommendations.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-3">
              <Zap className="h-5 w-5 text-amber-500" />
              Recommended for You
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recommendations.map(rec => (
                <div key={`${rec.subject}|${rec.topic}|${rec.subtopic}`} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs text-gray-500">{rec.subject}</p>
                      <p className="font-medium text-gray-900 text-sm">{rec.topic}</p>
                      <p className="text-xs text-gray-600">{rec.subtopic}</p>
                    </div>
                    <span className={`px-2 py-0.5 ${rec.classification === 'not_attempted' ? 'bg-gray-100 text-gray-600' : rec.classification === 'developing' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'} text-xs rounded-full font-medium`}>
                      {rec.classification === 'not_attempted' ? 'New' : rec.classification === 'developing' ? 'Developing' : 'Weak'}
                    </span>
                  </div>
                  {rec.reason && <p className="text-xs text-gray-600 mb-2">{rec.reason}</p>}
                  <p className="text-xs text-gray-500 mb-3">{rec.available} questions available{rec.scope.subtopic ? '' : ' in this topic'}</p>
                  <button
                    onClick={() => {
                      const p = new URLSearchParams({ subject: rec.scope.subject, topic: rec.scope.topic });
                      if (rec.scope.subtopic) p.set('subtopic', rec.scope.subtopic);
                      navigate(`/practice/start?${p.toString()}`);
                    }}
                    className="w-full py-1.5 bg-amber-500 text-white text-sm rounded-md hover:bg-amber-600"
                  >
                    Practice Now
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Available Tests */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Available Tests
            </h2>

            {tests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <BookOpen className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-gray-600">No tests available yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tests.map((test) => {
                  const h = history[test.id];
                  const lastAttempt = h?.last_attempt;
                  const pendingAttempt = h?.attempts?.find(a => a.status === 'in_progress');
                  return (
                    <div key={test.id} className="bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{test.title}</h3>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeColor(test.type)}`}>
                                {typeLabel(test.type)}
                              </span>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${stageColor(test.exam_stage)}`}>
                                {test.exam_stage}
                              </span>
                            </div>
                            {lastAttempt && (
                              <p className="text-xs text-gray-500">
                                Last attempted: {new Date(lastAttempt.started_at).toLocaleDateString()}
                                {lastAttempt.score !== null && ` — Score: ${lastAttempt.score}`}
                              </p>
                            )}
                            {!lastAttempt && (
                              <p className="text-xs text-gray-400">Not attempted yet</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {h?.best_score !== null && (
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Best</p>
                                <p className="text-sm font-bold text-blue-600">{h?.best_score?.toFixed(1)}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{test.duration_minutes}min</span>
                          <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" />{Array.isArray(test.question_ids) ? test.question_ids.length : 0} Qs</span>
                          {test.negative_marking_ratio > 0 && (
                            <span className="text-amber-600">-{(test.negative_marking_ratio * 100).toFixed(0)}% neg</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {pendingAttempt ? (
                            <>
                              <button
                                onClick={() => navigate(`/test/${test.id}`)}
                                className="px-4 py-1.5 bg-amber-500 text-white text-sm rounded-md hover:bg-amber-600"
                              >
                                Resume Test
                              </button>
                              <button
                                onClick={() => navigate(`/results/${pendingAttempt.attempt_id!}`)}
                                className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
                              >
                                View Progress
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleStartTest(test.id)}
                              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                            >
                              {lastAttempt ? 'Retake' : 'Start Test'}
                            </button>
                          )}
                          {h?.attempts?.filter(a => a.status === 'completed').length > 0 && (
                            <button
                              onClick={() => { const completed = h.attempts.filter(x => x.status === 'completed'); if (completed.length > 0) handleViewResults(completed[0].attempt_id!); }}
                              className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
                            >
                              View Last Results
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expertise Map sidebar */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Brain className="h-5 w-5 text-indigo-600" />
              Your Expertise Map
            </h2>
            <p className="text-xs text-gray-500">Live mastery tracking — updates as you practice</p>
            <ExpertiseMap />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Tests</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{Object.values(history).filter(h => h.attempts?.length > 0).length}</p>
            <p className="text-xs text-gray-500">attempted</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <Award className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Subjects</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{subjects.length}</p>
            <p className="text-xs text-gray-500">available</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Topics</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{subjects.reduce((s, sub) => s + sub.topics.length, 0)}</p>
            <p className="text-xs text-gray-500">to practice</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Questions</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{subjects.reduce((s, sub) => s + sub.topics.reduce((st, t) => st + t.subtopics.reduce((ss, stt) => ss + stt.total, 0), 0), 0)}</p>
            <p className="text-xs text-gray-500">in bank</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
