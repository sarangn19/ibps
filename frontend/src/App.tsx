import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import TestTaking from './pages/TestTaking';
import Results from './pages/Results';
import TopicPractice from './pages/TopicPractice';
import AdminDashboard from './pages/AdminDashboard';
import StudentDetail from './pages/StudentDetail';
import CohortView from './pages/CohortView';
import QuestionBank from './pages/QuestionBank';
import GenerateTest from './pages/GenerateTest';

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

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
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
            path="/test/:testId"
            element={
              <ProtectedRoute>
                <TestTaking />
              </ProtectedRoute>
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
              <ProtectedRoute>
                <TopicPractice />
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
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
