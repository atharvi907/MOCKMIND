import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Domains from "./pages/Domains";
import Interview from "./pages/Interview";
import Feedback from "./pages/Feedback";
import History from "./pages/History";
import QuestionBank from "./pages/QuestionBank";
import InterviewDetail from "./pages/InterviewDetail";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#05050A] flex items-center justify-center text-white">
        <p className="mono-label">Loading MockMind...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/signup" element={<Auth mode="signup" />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/domains" element={<Protected><Domains /></Protected>} />
          <Route path="/interview/:id" element={<Protected><Interview /></Protected>} />
          <Route path="/feedback/:id" element={<Protected><Feedback /></Protected>} />
          <Route path="/history" element={<Protected><History /></Protected>} />
          <Route path="/interview-history/:id" element={<Protected><InterviewDetail /></Protected>} />
          <Route path="/question-bank" element={<Protected><QuestionBank /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" theme="dark" toastOptions={{ style: { background: "#0D0D14", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" } }} />
    </AuthProvider>
  );
}

export default App;
