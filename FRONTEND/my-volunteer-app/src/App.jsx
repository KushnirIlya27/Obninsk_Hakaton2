import { Routes, Route, Navigate } from "react-router-dom";
import WelcomePage from "./WelcomePage";
import LoginPage from "./LoginPage";
import CoordinatorPage from "./CoordinatorPage";
import VolunteerPage from "./VolunteerPage";
import VolunteerLayout from "./VolunteerLayout";
import VolunteerDashboard from "./VolunteerDashboard";
import VolunteerRewards from "./VolunteerRewards";
import VolunteerProfile from "./VolunteerProfile";
import CoordinatorDashboard from "./CoordinatorDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthProvider from "./auth/AuthProvider";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/coordinator" element={<CoordinatorPage />} />
        <Route path="/volunteer" element={<VolunteerPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <VolunteerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<VolunteerDashboard />} />
          <Route path="rewards" element={<VolunteerRewards />} />
          <Route path="profile" element={<VolunteerProfile />} />
        </Route>
        <Route
          path="/coordinator-dashboard"
          element={
            <ProtectedRoute coordinator>
              <CoordinatorDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
