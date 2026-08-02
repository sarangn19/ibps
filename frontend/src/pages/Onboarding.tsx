import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const EXAMS = [
  'IBPS PO',
  'IBPS Clerk',
  'IBPS RRB PO',
  'IBPS RRB Clerk',
  'SBI PO',
  'SBI Clerk',
  'RBI Assistant',
  'Custom Goal'
];

const LEVELS = [
  { id: 'beginner', title: 'Beginner', desc: 'New to banking exams or haven\'t studied in a while' },
  { id: 'intermediate', title: 'Intermediate', desc: 'Some preparation done, need structured practice' },
  { id: 'advanced', title: 'Advanced', desc: 'Practiced before, aiming to polish weak areas' }
];

const TIME_SLOTS = [30, 60, 90, 120, 180];

const Onboarding: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [exam_goal, setExamGoal] = useState(user?.exam_goal || '');
  const [target_year, setTargetYear] = useState<number>(user?.target_year || new Date().getFullYear());
  const [prep_level, setPrepLevel] = useState(user?.prep_level || '');
  const [daily_study_minutes, setDailyMinutes] = useState<number>(user?.daily_study_minutes || 60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canNext = () => {
    if (step === 0) return exam_goal !== '';
    if (step === 1) return target_year >= 2020 && target_year <= new Date().getFullYear() + 5;
    if (step === 2) return prep_level !== '';
    return true;
  };

  const handleFinish = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await api.post('/auth/me/onboarding', {
        exam_goal,
        target_year,
        prep_level,
        daily_study_minutes
      });
      updateUser(res.data);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save your preferences');
      setSaving(false);
    }
  };

  const steps = ['Choose Exam', 'Target Year', 'Prep Level', 'Daily Study Time'];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-10">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-md p-5 sm:p-8 mx-4">
        <div className="text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Let's set up your prep</h1>
          <p className="text-gray-500 mt-1 text-sm">Personalize your IBPS Coaching experience</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 mb-6 overflow-x-auto pb-1">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${i === step ? 'text-blue-600 font-medium' : 'text-gray-500'} hidden sm:inline`}>{s}</span>
              {i < steps.length - 1 && <div className={`h-0.5 w-6 ${i < step ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Step 0: Exam */}
        {step === 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Which exam are you preparing for?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EXAMS.map(exam => (
                <button
                  key={exam}
                  onClick={() => setExamGoal(exam)}
                  className={`p-4 rounded-lg border text-left transition-colors ${exam_goal === exam ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}`}
                >
                  <span className="font-medium text-gray-900">{exam}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Target year */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">What's your target exam year?</h2>
            <p className="text-sm text-gray-500 mb-4">We'll calibrate the study plan around your deadline.</p>
            <select
              value={target_year}
              onChange={(e) => setTargetYear(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[new Date().getFullYear(), new Date().getFullYear() + 1, new Date().getFullYear() + 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        {/* Step 2: Prep level */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">How would you describe your current preparation level?</h2>
            <div className="space-y-3">
              {LEVELS.map(level => (
                <button
                  key={level.id}
                  onClick={() => setPrepLevel(level.id)}
                  className={`w-full p-4 rounded-lg border text-left transition-colors ${prep_level === level.id ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}`}
                >
                  <span className="block font-medium text-gray-900">{level.title}</span>
                  <span className="block text-sm text-gray-500 mt-0.5">{level.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Daily study time */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">How much time can you study daily?</h2>
            <p className="text-sm text-gray-500 mb-4">We'll size your daily practice targets around this.</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {TIME_SLOTS.map(t => (
                <button
                  key={t}
                  onClick={() => setDailyMinutes(t)}
                  className={`p-4 rounded-lg border text-center transition-colors ${daily_study_minutes === t ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}`}
                >
                  <span className="block font-bold text-gray-900 text-lg">{t}</span>
                  <span className="block text-xs text-gray-500">min</span>
                </button>
              ))}
            </div>
            {!TIME_SLOTS.includes(daily_study_minutes) && (
              <input
                type="number"
                value={daily_study_minutes}
                onChange={(e) => setDailyMinutes(parseInt(e.target.value, 10))}
                className="mt-4 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Custom minutes"
              />
            )}
          </div>
        )}

        {/* Nav */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-40 text-sm font-medium"
          >
            ← Back
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 text-sm font-medium"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? 'Saving...' : 'Finish & Go to Dashboard'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
