import { lazy, Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Lazy-loaded Public Pages
const Landing = lazy(() => import('./pages/public/Landing'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'));

// Lazy-loaded Dashboard Pages
const Dashboard = lazy(() => import('./pages/student/Dashboard'));
const Profile = lazy(() => import('./pages/student/Profile'));
const Doubts = lazy(() => import('./pages/student/Doubts'));
const DoubtDetail = lazy(() => import('./pages/student/DoubtDetail'));
const CreateDoubt = lazy(() => import('./pages/student/CreateDoubt'));
const Mentors = lazy(() => import('./pages/student/Mentors'));
const MentorDetail = lazy(() => import('./pages/student/MentorDetail'));
const Gigs = lazy(() => import('./pages/student/Gigs'));
const GigDetail = lazy(() => import('./pages/student/GigDetail'));
const MyApplications = lazy(() => import('./pages/student/MyApplications'));
const Wallet = lazy(() => import('./pages/student/Wallet'));
const Notifications = lazy(() => import('./pages/student/Notifications'));
const Chat = lazy(() => import('./pages/student/Chat'));
const Resources = lazy(() => import('./pages/student/Resources'));
const StudentVerification = lazy(() => import('./pages/student/Verification'));

// Lazy-loaded Company Pages
const CompanyDashboard = lazy(() => import('./pages/company/Dashboard'));
const PostGig = lazy(() => import('./pages/company/PostGig'));
const ManageGigs = lazy(() => import('./pages/company/ManageGigs'));
const ViewApplications = lazy(() => import('./pages/company/ViewApplications'));
const CompanyVerification = lazy(() => import('./pages/company/Verification'));

// Lazy-loaded Mentor Pages
const MentorDashboard = lazy(() => import('./pages/mentor/Dashboard'));
const MentorRequests = lazy(() => import('./pages/mentor/Requests'));
const MentorSessions = lazy(() => import('./pages/mentor/Sessions'));
const AlumniVerification = lazy(() => import('./pages/mentor/Verification'));

// Lazy-loaded Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminVerifications = lazy(() => import('./pages/admin/Verifications'));
const AdminFlaggedContent = lazy(() => import('./pages/admin/FlaggedContent'));
const AdminDisputes = lazy(() => import('./pages/admin/Disputes'));
const AdminAuditLog = lazy(() => import('./pages/admin/AuditLog'));

// Lazy-loaded Social Pages
const People = lazy(() => import('./pages/social/People'));
const Feed = lazy(() => import('./pages/social/Feed'));

// Loading fallback — minimal spinner
const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>
  </div>
);

// Inline loading for Suspense boundaries inside dashboard
const PageLoading = () => (
  <div className="flex items-center justify-center py-20">
    <div className="text-center">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
      <p className="text-gray-400 text-sm">Loading page...</p>
    </div>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Guest Route Component (redirect if already logged in)
const GuestRoute = ({ children }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const user = useAuthStore(state => state.user);

  if (isAuthenticated) {
    const role = user?.role;
    const dashboard = role === 'admin' ? '/admin/dashboard'
      : role === 'alumni' ? '/mentor/dashboard'
      : role === 'company' ? '/company/dashboard'
      : '/dashboard';
    return <Navigate to={dashboard} replace />;
  }

  return children;
};

function App() {
  const initializeAuth = useAuthStore(state => state.initializeAuth);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      initializeAuth();
      setAuthReady(true);
    });
    if (useAuthStore.persist.hasHydrated()) {
      initializeAuth();
      setAuthReady(true);
    }
    return unsub;
  }, [initializeAuth]);

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#1f2937',
            boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />
      {authReady ? (
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<Landing />} />
            </Route>

            {/* Auth Routes */}
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* Student Dashboard Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="profile" element={<Profile />} />
              <Route path="doubts" element={<Doubts />} />
              <Route path="doubts/:id" element={<DoubtDetail />} />
              <Route path="doubts/create" element={<CreateDoubt />} />
              <Route path="mentors" element={<Mentors />} />
              <Route path="mentors/:id" element={<MentorDetail />} />
              <Route path="gigs" element={<Gigs />} />
              <Route path="gigs/:id" element={<GigDetail />} />
              <Route path="my-applications" element={<MyApplications />} />
              <Route path="wallet" element={<Wallet />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="chat" element={<Chat />} />
              <Route path="resources" element={<Resources />} />
              <Route path="verification" element={<StudentVerification />} />
              <Route path="people" element={<People />} />
              <Route path="feed" element={<Feed />} />
            </Route>

            {/* Company Routes */}
            <Route
              path="/company"
              element={
                <ProtectedRoute allowedRoles={['company']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<CompanyDashboard />} />
              <Route path="post-gig" element={<PostGig />} />
              <Route path="manage-gigs" element={<ManageGigs />} />
              <Route path="gigs/:id/applications" element={<ViewApplications />} />
              <Route path="verification" element={<CompanyVerification />} />
            </Route>

            {/* Mentor Routes */}
            <Route
              path="/mentor"
              element={
                <ProtectedRoute allowedRoles={['alumni']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<MentorDashboard />} />
              <Route path="requests" element={<MentorRequests />} />
              <Route path="sessions" element={<MentorSessions />} />
              <Route path="verification" element={<AlumniVerification />} />
            </Route>

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="verifications" element={<AdminVerifications />} />
              <Route path="flagged-content" element={<AdminFlaggedContent />} />
              <Route path="disputes" element={<AdminDisputes />} />
              <Route path="audit-log" element={<AdminAuditLog />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      ) : (
        <Loading />
      )}
    </Router>
  );
}

export default App;
