import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Public Pages
import Landing from './pages/public/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Dashboard Pages
import Dashboard from './pages/student/Dashboard';
import Profile from './pages/student/Profile';
import Doubts from './pages/student/Doubts';
import DoubtDetail from './pages/student/DoubtDetail';
import CreateDoubt from './pages/student/CreateDoubt';
import Mentors from './pages/student/Mentors';
import MentorDetail from './pages/student/MentorDetail';
import Gigs from './pages/student/Gigs';
import GigDetail from './pages/student/GigDetail';
import MyApplications from './pages/student/MyApplications';
import Wallet from './pages/student/Wallet';
import Notifications from './pages/student/Notifications';
import Chat from './pages/student/Chat';
import Resources from './pages/student/Resources';

// Company Pages
import CompanyDashboard from './pages/company/Dashboard';
import PostGig from './pages/company/PostGig';
import ManageGigs from './pages/company/ManageGigs';
import ViewApplications from './pages/company/ViewApplications';

// Mentor Pages
import MentorDashboard from './pages/mentor/Dashboard';
import MentorRequests from './pages/mentor/Requests';
import MentorSessions from './pages/mentor/Sessions';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminVerifications from './pages/admin/Verifications';
import AdminFlaggedContent from './pages/admin/FlaggedContent';
import AdminDisputes from './pages/admin/Disputes';
import AdminAuditLog from './pages/admin/AuditLog';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
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
  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<Landing />} />
        </Route>

        {/* Auth Routes */}
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
        <Route path="/reset-password" element={<GuestRoute><ResetPassword /></GuestRoute>} />

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
    </Router>
  );
}

export default App;
