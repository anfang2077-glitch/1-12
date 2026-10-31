import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ToastProvider from './components/Toast';
import Layout from './components/Layout';
import Loading from './components/Loading';
import { RequireAuth, RequireRole } from './components/RouteGuards';
import LoginPage from './pages/LoginPage';
import ForbiddenPage from './pages/ForbiddenPage';
import NotFoundPage from './pages/NotFoundPage';
import OverviewPage from './pages/admin/OverviewPage';
import UsersPage from './pages/admin/UsersPage';
import CoursesPage from './pages/admin/CoursesPage';
import QuestionsPage from './pages/teacher/QuestionsPage';
import ExamsPage from './pages/teacher/ExamsPage';
import ExamFormPage from './pages/teacher/ExamFormPage';
import GradingPage from './pages/teacher/GradingPage';
import StatsPage from './pages/teacher/StatsPage';
import MyExamsPage from './pages/student/MyExamsPage';
import ExamPage from './pages/student/ExamPage';
import ResultPage from './pages/student/ResultPage';
import ScoresPage from './pages/student/ScoresPage';
import { homePath } from './utils/format';

function RoleHome() {
  const { user, booting } = useAuth();
  if (booting) return <Loading full text="正在校验登录状态…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homePath(user.role)} replace />;
}

// 管理员具备教学管理权限（基线第 3 节），因此 /teacher/* 页面同时放行 admin
const TEACHING_ROLES = ['teacher', 'admin'];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/403" element={<ForbiddenPage />} />

            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route
                path="/admin/overview"
                element={
                  <RequireRole roles={['admin']}>
                    <OverviewPage />
                  </RequireRole>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RequireRole roles={['admin']}>
                    <UsersPage />
                  </RequireRole>
                }
              />
              <Route
                path="/admin/courses"
                element={
                  <RequireRole roles={['admin']}>
                    <CoursesPage />
                  </RequireRole>
                }
              />

              <Route
                path="/teacher/questions"
                element={
                  <RequireRole roles={TEACHING_ROLES}>
                    <QuestionsPage />
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/exams"
                element={
                  <RequireRole roles={TEACHING_ROLES}>
                    <ExamsPage />
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/exams/new"
                element={
                  <RequireRole roles={TEACHING_ROLES}>
                    <ExamFormPage />
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/grading"
                element={
                  <RequireRole roles={TEACHING_ROLES}>
                    <GradingPage />
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/stats"
                element={
                  <RequireRole roles={TEACHING_ROLES}>
                    <StatsPage />
                  </RequireRole>
                }
              />

              <Route
                path="/student/exams"
                element={
                  <RequireRole roles={['student']}>
                    <MyExamsPage />
                  </RequireRole>
                }
              />
              <Route
                path="/student/exam/:examId"
                element={
                  <RequireRole roles={['student']}>
                    <ExamPage />
                  </RequireRole>
                }
              />
              <Route
                path="/student/result/:attemptId"
                element={
                  <RequireRole roles={['student']}>
                    <ResultPage />
                  </RequireRole>
                }
              />
              <Route
                path="/student/scores"
                element={
                  <RequireRole roles={['student']}>
                    <ScoresPage />
                  </RequireRole>
                }
              />
            </Route>

            <Route path="/" element={<RoleHome />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
