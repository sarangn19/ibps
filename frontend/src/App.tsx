import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import TestTaking from './pages/TestTaking';
import Results from './pages/Results';
import TopicPractice from './pages/TopicPractice';
import CurrentAffairs from './pages/CurrentAffairs';
import AdminDashboard from './pages/AdminDashboard';
import StudentDetail from './pages/StudentDetail';
import CohortView from './pages/CohortView';
import QuestionBank from './pages/QuestionBank';
import GenerateTest from './pages/GenerateTest';
import SuperAdmin from './pages/SuperAdmin';
import Paywall from './pages/Paywall';
import UxResearch from './pages/UxResearch';
import Student360 from './pages/Student360';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

// Gates paid study features. Admins/superadmins always pass; students are
// blocked once their 14-day trial (or free grant) has ended.
const RequireAccess: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, access, loading } = useAuth();

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (user.role === 'admin' || user.role === 'superadmin') {
    return <>{children}</>;
  }

  if (!access) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (access.allowed) {
    return <>{children}</>;
  }

  return <Paywall />;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role !== 'superadmin') {
    return <Navigate to="/admin" />;
  }

  return <>{children}</>;
};

const OnboardingRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role !== 'admin' && !user.onboarding_completed) {
    return <>{children}</>;
  }

  return <Navigate to="/dashboard" />;
};

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [pathname]);

  return null;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <OnboardingRoute>
                <Onboarding />
              </OnboardingRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/test/:testId"
            element={
              <RequireAccess>
                <TestTaking />
              </RequireAccess>
            }
          />
          <Route
            path="/results/:attemptId"
            element={
              <ProtectedRoute>
                <Results />
              </ProtectedRoute>
            }
          />
          <Route
            path="/practice/start"
            element={
              <RequireAccess>
                <TopicPractice />
              </RequireAccess>
            }
          />
          <Route
            path="/current-affairs"
            element={
              <RequireAccess>
                <CurrentAffairs />
              </RequireAccess>
            }
          />
          <Route
            path="/subscribe"
            element={
              <ProtectedRoute>
                <Paywall />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/students/:id"
            element={
              <AdminRoute>
                <StudentDetail />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/cohort"
            element={
              <AdminRoute>
                <CohortView />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/questions"
            element={
              <AdminRoute>
                <QuestionBank />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/tests/generate"
            element={
              <AdminRoute>
                <GenerateTest />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/superadmin"
            element={
              <SuperAdminRoute>
                <SuperAdmin />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/admin/research"
            element={
              <AdminRoute>
                <UxResearch />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/research/students"
            element={
              <AdminRoute>
                <Student360 />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/research/students/:id"
            element={
              <AdminRoute>
                <Student360 />
              </AdminRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
