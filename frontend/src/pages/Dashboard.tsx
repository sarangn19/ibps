import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Test, TestHistory, SubjectTree, StudyPlan, DailyRevision } from '../types';
import api from '../utils/api';
import ExpertiseMap from '../components/ExpertiseMap';
import MobileNav from '../components/MobileNav';
import PageHeader from '../components/PageHeader';
import InsightPanel from '../components/InsightPanel';
import { generateDashboardInsights } from '../utils/insightEngine';
import { BookOpen, Clock, BarChart3, Award, TrendingUp, Target, Zap, Brain, Calendar, Flame, RefreshCw, Sparkles } from 'lucide-react';

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
  const { user, logout, access } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState<Test[]>([]);
  const [history, setHistory] = useState<Record<number, TestHistory>>({});
  const [subjects, setSubjects] = useState<SubjectTree[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [revision, setRevision] = useState<DailyRevision | null>(null);
  const [easyGA, setEasyGA] = useState<Test | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchTests(), fetchHistory(), fetchSubjects(), fetchRecommendations(), fetchStudyPlan(), fetchRevision(), fetchEasyGA()]).finally(() => setLoading(false));
  }, []);

  const fetchRevision = async () => {
    try {
      const res = await api.get('/revision/daily');
      setRevision(res.data);
    } catch (e) { /* students without access won't have revision yet */ }
  };

  const fetchEasyGA = async () => {
    try {
      const res = await api.get('/practice/easy-ga');
      setEasyGA(res.data);
    } catch (e) { /* skip if not available */ }
  };

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await api.post('/revision/checkin');
      const res = await api.get('/revision/daily');
      setRevision(res.data);
    } catch (e) {
      console.error('Revision check-in failed:', e);
    } finally {
      setCheckingIn(false);
    }
  };

  const fetchStudyPlan = async () => {
    try {
      const res = await api.get('/auth/me/study-plan');
      setStudyPlan(res.data);
    } catch (e) { /* skip if onboarding not complete */ }
  };

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
      case 'full_mock': return 'bg-lingo-blue/10 text-lingo-blue-dark';
      case 'sectional': return 'bg-lingo-border text-gray-700';
      case 'topic_practice': return 'bg-lingo-border text-gray-700';
      default: return 'bg-lingo-border text-gray-700';
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

  const stageColor = (_stage: string) => 'bg-lingo-border text-gray-600';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lingo-bg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-lingo-border border-t-lingo-green"></div>
          <p className="mt-3 text-gray-600 font-bold">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const insights = generateDashboardInsights(history, recommendations, studyPlan);

  return (
    <div className="min-h-screen bg-lingo-bg">
      <PageHeader
        title="IBPS Coaching"
        showBack={false}
        right={
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-700 hidden sm:inline">{user?.name}</span>
            <button onClick={logout} className="text-sm font-bold text-lingo-red hover:text-lingo-red-dark touch-target px-2">Logout</button>
          </div>
        }
      />

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-6 pb-nav">

        {/* Subscription banner (students only) */}
        {user?.role === 'student' && access && (
          access.allowed ? (
            access.plan === 'trial' ? (
              <div className="flex items-center justify-between gap-3 lingo-card p-4 border-lingo-blue">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-lingo-blue/15 text-lingo-blue-dark">
                    <Zap className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">Free trial: {access.trial_days_left} day{access.trial_days_left === 1 ? '' : 's'} left</p>
                    <p className="text-xs text-gray-500 font-semibold">Upgrade anytime for ₹{access.amount_per_month}/month</p>
                  </div>
                </div>
                <button onClick={() => navigate('/subscribe')} className="shrink-0 lingo-btn lingo-btn-green text-xs px-3 py-2">Upgrade</button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 lingo-card p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-lingo-green/15 text-lingo-green-dark">
                  <Award className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">
                    {access.plan === 'granted_free' ? 'Free subscription active' : 'Pro subscription active'}
                  </p>
                  <p className="text-xs text-gray-500 font-semibold">
                    {access.ends_at
                      ? `Valid till ${new Date(access.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : 'Unlimited access'}
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-between gap-3 lingo-card p-4 border-lingo-red">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-lingo-red/15 text-lingo-red">
                  <Zap className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Your free trial has ended</p>
                  <p className="text-xs text-gray-500 font-semibold">Subscribe to keep practicing</p>
                </div>
              </div>
              <button onClick={() => navigate('/subscribe')} className="shrink-0 lingo-btn lingo-btn-red text-xs px-3 py-2">Subscribe</button>
            </div>
          )
        )}

        {/* AI Insights */}
        <div>
          <InsightPanel title="Your Performance Insights" insights={insights} maxVisible={3} />
        </div>

        {/* Practice Your Weak Areas + Recommended for You */}
        <div className="lingo-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-lingo-blue text-white">
                  <Target className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-extrabold text-gray-900">Focus on Your Weak Areas</h2>
              </div>
              <p className="text-gray-600 text-sm max-w-lg">
                Pick a subject below or jump straight into a recommended topic.
              </p>
            </div>
          </div>

          {/* Subject quick-practice chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {subjects.slice(0, 5).map(s => (
              <button
                key={s.subject}
                onClick={() => handleStartPractice(s.subject)}
                className="px-4 py-2 bg-lingo-green/15 text-lingo-green-dark hover:bg-lingo-green hover:text-white rounded-xl text-sm font-bold transition-colors"
              >
                {s.subject}
              </button>
            ))}
          </div>

          {/* Recommended topics */}
          {recommendations.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recommendations.slice(0, 3).map(rec => (
                <div key={`${rec.subject}|${rec.topic}|${rec.subtopic}`} className="border-2 border-lingo-border rounded-2xl p-4 hover:-translate-y-0.5 transition-transform">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs text-gray-500">{rec.subject}</p>
                      <p className="font-bold text-gray-900 text-sm">{rec.topic}</p>
                      <p className="text-xs text-gray-600">{rec.subtopic}</p>
                    </div>
                    <span className={`px-2 py-0.5 ${rec.classification === 'not_attempted' ? 'bg-lingo-border text-gray-600' : rec.classification === 'developing' ? 'bg-lingo-blue/15 text-lingo-blue-dark' : 'bg-lingo-red/15 text-lingo-red'} text-xs rounded-xl font-bold uppercase`}>
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
                    className="w-full py-1.5 bg-lingo-blue text-white text-sm rounded-xl font-bold hover:bg-lingo-blue-dark"
                  >
                    Practice Now
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Daily Revision & Streak */}
        {revision && (
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2 mb-3">
              <Flame className="h-5 w-5 text-lingo-blue-dark" />
              Daily Revision
            </h2>
            <div className="lingo-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${revision.today_checked ? 'bg-lingo-green/15 text-lingo-green-dark' : 'bg-lingo-blue/15 text-lingo-blue-dark'}`}>
                    <Flame className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-2xl font-extrabold text-gray-900 leading-none">{revision.streak} day{revision.streak === 1 ? '' : 's'}</p>
                    <p className="text-xs text-gray-500 font-semibold mt-1">
                      {revision.today_checked ? 'Revised today — streak safe' : revision.streak > 0 ? 'Revise today to keep your streak' : 'Revise today to start your streak'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn || revision.today_checked}
                  className={`shrink-0 px-4 py-2 text-sm rounded-xl font-bold border-b-4 active:scale-[0.97] whitespace-nowrap ${
                    revision.today_checked
                      ? 'bg-lingo-border text-gray-500 border-lingo-border/60 cursor-default'
                      : 'bg-lingo-green text-white border-lingo-green-dark hover:bg-lingo-green-dark'
                  }`}
                >
                  {checkingIn ? 'Saving...' : revision.today_checked ? 'Revised ✓' : 'I revised today'}
                </button>
              </div>

              {revision.due_topics.length === 0 ? (
                <p className="text-sm text-gray-500">Nothing due right now — your weak areas are under control.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 font-semibold">
                    <RefreshCw className="h-3.5 w-3.5 inline mr-1 text-lingo-blue-dark" />
                    {revision.due_topics.length} topic{revision.due_topics.length === 1 ? '' : 's'} due for a quick refresh:
                  </p>
                  {revision.due_topics.map(t => (
                    <div key={`${t.scope.subject}|${t.scope.topic}|${t.scope.subtopic || ''}`} className="flex flex-wrap items-center justify-between gap-2 border-2 border-lingo-border rounded-xl px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{t.topic}{t.scope.subtopic ? ` · ${t.scope.subtopic}` : ''}</p>
                        <p className="text-xs text-gray-500">
                          {t.accuracy_rolling !== null ? `${Math.round(t.accuracy_rolling)}% accuracy` : t.classification} · {t.available} questions
                          {t.days_since_last_attempt !== null ? ` · ${t.days_since_last_attempt}d ago` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const p = new URLSearchParams({ subject: t.scope.subject, topic: t.scope.topic });
                          if (t.scope.subtopic) p.set('subtopic', t.scope.subtopic);
                          navigate(`/practice/start?${p.toString()}`);
                        }}
                        className="shrink-0 px-3 py-1.5 bg-lingo-blue text-white text-xs rounded-xl font-bold hover:bg-lingo-blue-dark whitespace-nowrap"
                      >
                        Revise
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Easy-mode GA practice */}
        {easyGA && user?.role === 'student' && (
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-lingo-blue-dark" />
              Build Confidence with Easy Practice
            </h2>
            <div className="lingo-card p-5">
              <p className="text-sm text-gray-600 mb-1 font-semibold">General Awareness — Easy Mode</p>
              <p className="text-xs text-gray-500 mb-4">Beginner-friendly set with no negative marking. Warm up before attempting full mocks.</p>
              <button
                onClick={() => navigate(`/test/${easyGA.id}`)}
                className="w-full px-4 py-2 bg-lingo-blue text-white text-sm rounded-xl font-bold border-b-4 border-lingo-blue-dark hover:bg-lingo-blue-dark active:scale-[0.97]"
              >
                Start Easy Practice ({Array.isArray(easyGA.question_ids) ? easyGA.question_ids.length : 15} questions · 15 min)
              </button>
            </div>
          </div>
        )}

        {/* Your Study Plan */}
        {studyPlan && (
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2 mb-3">
              <Calendar className="h-5 w-5 text-lingo-blue-dark" />
              Your Weekly Study Plan
            </h2>
            <div className="lingo-card p-5">
              <div className="flex flex-wrap gap-3 mb-4 text-sm">
                <span className="lingo-chip bg-lingo-blue/15 text-lingo-blue-dark">{studyPlan.exam_goal} {studyPlan.target_year}</span>
                <span className="lingo-chip bg-lingo-bg text-gray-700 capitalize">{studyPlan.prep_level}</span>
                <span className="lingo-chip bg-lingo-bg text-gray-700">~{studyPlan.questions_per_day} questions/day</span>
                {studyPlan.avg_accuracy !== null && (
                  <span className="lingo-chip bg-lingo-blue/15 text-lingo-blue-dark">Avg accuracy {studyPlan.avg_accuracy}%</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {studyPlan.weekly_plan.slice(0, 4).map(d => (
                  <div key={d.day} className="border-2 border-lingo-border rounded-xl p-3">
                    <p className="text-xs font-bold text-lingo-blue-dark uppercase">{d.day_name}</p>
                    <p className="font-bold text-gray-900 text-sm mt-1">{d.focus_subject}</p>
                    <p className="text-xs text-gray-600">{d.topics.join(', ')}</p>
                    <p className="text-xs text-gray-500 mt-2">{d.questions_to_practice} questions</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">{studyPlan.weekly_plan[0]?.activity}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Expertise Map */}
          <div className="space-y-4 order-1 lg:order-2">
            <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
              <Brain className="h-5 w-5 text-lingo-blue-dark" />
              Your Expertise Map
            </h2>
            <p className="text-xs text-gray-500">Live mastery tracking — updates as you practice</p>
            <ExpertiseMap />
          </div>

          {/* Available Tests */}
          <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
            <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-lingo-blue-dark" />
              Available Tests
            </h2>

            {tests.length === 0 ? (
              <div className="text-center py-12 lingo-card">
                <BookOpen className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-gray-600 font-bold">No tests available yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tests.map((test) => {
                  const h = history[test.id];
                  const lastAttempt = h?.last_attempt;
                  const pendingAttempt = h?.attempts?.find(a => a.status === 'in_progress');
                  return (
                    <div key={test.id} className="lingo-card hover:-translate-y-0.5 transition-transform">
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-extrabold text-gray-900 leading-snug">{test.title}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className={`px-2 py-0.5 text-xs font-bold rounded-xl uppercase ${typeColor(test.type)}`}>
                                {typeLabel(test.type)}
                              </span>
                              <span className={`px-2 py-0.5 text-xs font-bold rounded-xl uppercase ${stageColor(test.exam_stage)}`}>
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
                            {h?.best_score != null && (
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Best</p>
                                <p className="text-sm font-extrabold text-lingo-blue-dark">{h?.best_score?.toFixed(1)}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{test.duration_minutes}min</span>
                          <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" />{Array.isArray(test.question_ids) ? test.question_ids.length : 0} Qs</span>
                          {test.negative_marking_ratio > 0 && (
                            <span className="text-gray-500 font-bold">-{(test.negative_marking_ratio * 100).toFixed(0)}% neg</span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {pendingAttempt ? (
                            <>
                              <button
                                onClick={() => navigate(`/test/${test.id}`)}
                                className="px-4 py-2 bg-lingo-blue text-white text-sm rounded-xl font-bold border-b-4 border-lingo-blue-dark hover:bg-lingo-blue-dark active:scale-[0.97] whitespace-nowrap"
                              >
                                Resume Test
                              </button>
                              <button
                                onClick={() => navigate(`/results/${pendingAttempt.attempt_id!}`)}
                                className="px-4 py-2 bg-lingo-bg text-gray-700 text-sm rounded-xl font-bold border-b-4 border-lingo-border hover:bg-lingo-border/60 active:scale-[0.97] whitespace-nowrap"
                              >
                                View Progress
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleStartTest(test.id)}
                              className="px-4 py-2 bg-lingo-blue text-white text-sm rounded-xl font-bold border-b-4 border-lingo-blue-dark hover:bg-lingo-blue-dark active:scale-[0.97] whitespace-nowrap"
                            >
                              {lastAttempt ? 'Retake' : 'Start Test'}
                            </button>
                          )}
                          {h?.attempts?.filter(a => a.status === 'completed').length > 0 && (
                            <button
                              onClick={() => { const completed = h.attempts.filter(x => x.status === 'completed'); if (completed.length > 0) handleViewResults(completed[0].attempt_id!); }}
                              className="px-4 py-2 bg-lingo-bg text-gray-700 text-sm rounded-xl font-bold border-b-4 border-lingo-border hover:bg-lingo-border/60 active:scale-[0.97] whitespace-nowrap"
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
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="lingo-card p-4">
            <div className="flex items-center gap-2 text-lingo-blue-dark mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-extrabold uppercase tracking-wide">Tests</span>
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{Object.values(history).filter(h => h.attempts?.length > 0).length}</p>
            <p className="text-xs text-gray-500">attempted</p>
          </div>
          <div className="lingo-card p-4">
            <div className="flex items-center gap-2 text-lingo-blue-dark mb-1">
              <Award className="h-4 w-4" />
              <span className="text-xs font-extrabold uppercase tracking-wide">Subjects</span>
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{subjects.length}</p>
            <p className="text-xs text-gray-500">available</p>
          </div>
          <div className="lingo-card p-4">
            <div className="flex items-center gap-2 text-lingo-blue-dark mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-extrabold uppercase tracking-wide">Topics</span>
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{subjects.reduce((s, sub) => s + sub.topics.length, 0)}</p>
            <p className="text-xs text-gray-500">to practice</p>
          </div>
          <div className="lingo-card p-4">
            <div className="flex items-center gap-2 text-lingo-blue-dark mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs font-extrabold uppercase tracking-wide">Questions</span>
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{subjects.reduce((s, sub) => s + sub.topics.reduce((st, t) => st + t.subtopics.reduce((ss, stt) => ss + stt.total, 0), 0), 0)}</p>
            <p className="text-xs text-gray-500">in bank</p>
          </div>
        </div>

        <MobileNav />
      </div>
    </div>
  );
};

export default Dashboard;
