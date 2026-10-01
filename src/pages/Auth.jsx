import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, ArrowRight, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ParticlesBG from "../components/ParticlesBG";

const getApiError = (err) => {
  if (err?.code === "ERR_NETWORK" || err?.message === "Network Error") {
    return "Cannot reach the MockMind server. Please verify backend is running on http://127.0.0.1:8000.";
  }
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || item.message || JSON.stringify(item)).join(" ");
  }
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (status === 409) return "An account with this email already exists.";
  if (status === 401) return "Invalid email or password.";
  if (status === 403) return "User account is inactive or forbidden.";
  if (status === 500) return "Database or internal server error. Please try again.";

  return err?.message || "Authentication failed. Please check your credentials.";
};

export default function Auth({ mode = "login" }) {
  const isLogin = mode === "login";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleForgotPassword = () => {
    toast.info("Password reset link request feature is enabled. Check your email inbox if registered.", {
      duration: 4000,
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.email.includes("@")) {
      toast.error("Please provide a valid email address.");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    setLoading(true);
    try {
      const res = isLogin
        ? await authApi.login({ email: form.email, password: form.password })
        : await authApi.signup(form);
      login(res);
      toast.success(isLogin ? "Welcome back!" : "Account created successfully");
      navigate("/dashboard");
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen text-white grid grid-cols-1 lg:grid-cols-2">
      <ParticlesBG />
      {/* Left visual */}
      <div className="hidden lg:flex relative flex-col justify-between p-12 border-r border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00E5FF, #7000FF)" }}>
            <Brain className="w-5 h-5 text-black" />
          </div>
          <span className="font-display text-xl">MockMind</span>
        </div>

        <div>
          <p className="mono-label mb-4">AI Interview Coach</p>
          <h2 className="font-display text-4xl lg:text-5xl tracking-tighter leading-tight max-w-md">
            Rehearse with an AI that<br />
            <span className="neon-text">actually listens.</span>
          </h2>
          <p className="text-white/60 mt-6 max-w-md">
            Voice-powered technical interviews, deep feedback, and performance tracking — all in one console.
          </p>
        </div>

        <p className="text-xs text-white/30">© 2026 MockMind</p>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <motion.div
          className="w-full max-w-md glass p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="mono-label mb-2">{isLogin ? "Welcome back" : "Create Account"}</p>
          <h1 className="font-display text-3xl mb-8 tracking-tight">
            {isLogin ? "Log in to MockMind" : "Start your training"}
          </h1>

          <form onSubmit={submit} className="space-y-4" data-testid="auth-form">
            {!isLogin && (
              <div>
                <label className="mono-label block mb-2">Name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  required
                  className="input-dark"
                  placeholder="Ada Lovelace"
                  data-testid="auth-name-input"
                />
              </div>
            )}
            <div>
              <label className="mono-label block mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                required
                className="input-dark"
                placeholder="you@domain.com"
                data-testid="auth-email-input"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="mono-label block">Password</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
                    data-testid="forgot-password-btn"
                  >
                    <KeyRound className="w-3 h-3" /> Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={onChange}
                required
                minLength={8}
                className="input-dark"
                placeholder="Enter your password"
                data-testid="auth-password-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              data-testid="auth-submit-btn"
              className="btn-primary w-full flex items-center justify-center gap-2 mt-6"
            >
              {loading ? "Please wait..." : isLogin ? "Log in" : "Create account"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-sm text-white/60 mt-6 text-center">
            {isLogin ? "New here? " : "Already have an account? "}
            <Link
              to={isLogin ? "/signup" : "/login"}
              className="text-cyan-300 hover:text-cyan-200"
              data-testid="auth-switch-link"
            >
              {isLogin ? "Create account" : "Log in"}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
