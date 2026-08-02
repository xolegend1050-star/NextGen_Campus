import { lazy, Suspense, useEffect, useState } from 'react';
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

// Lazy-loaded Company Pages
const CompanyDashboard = lazy(() => import('./pages/company/Dashboard'));
const PostGig = lazy(() => import('./pages/company/PostGig'));
const ManageGigs = lazy(() => import('./pages/company/ManageGigs'));
const ViewApplications = lazy(() => import('./pages/company/ViewApplications'));

// Lazy-loaded Mentor Pages
const MentorDashboard = lazy(() => import('./pages/mentor/Dashboard'));
const MentorRequests = lazy(() => import('./pages/mentor/Requests'));
const MentorSessions = lazy(() => import('./pages/mentor/Sessions'));

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

// Loading fallback
const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600 font-medium">Loading...</p>
    </div>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuthStore();

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
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  const [hydrated, setHydrated] = useState(false);
  const initializeAuth = useAuthStore(state => state.initializeAuth);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    initializeAuth();
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, [initializeAuth]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-right" />
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<Landing />} />
          </Route>

          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
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
    </Router>
  );
}

export default App;
