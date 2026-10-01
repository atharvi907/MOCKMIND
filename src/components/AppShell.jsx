import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Target, History, LogOut, Brain, Sparkles, BookOpen } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, id: "nav-dashboard" },
  { to: "/domains", label: "Start Interview", icon: Target, id: "nav-domains" },
  { to: "/history", label: "History", icon: History, id: "nav-history" },
  { to: "/question-bank", label: "Question Bank", icon: BookOpen, id: "nav-question-bank" },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative min-h-screen flex text-white">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-white/5 bg-black/40 backdrop-blur-xl flex-col py-8 px-6 z-20" data-testid="app-sidebar">
        <div className="flex items-center gap-2 mb-12">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00E5FF, #7000FF)" }}>
            <Brain className="w-5 h-5 text-black" />
          </div>
          <span className="font-display text-xl tracking-tight">MockMind</span>
        </div>

        <nav className="flex flex-col gap-1">
          <p className="mono-label mb-3">Menu</p>
          {links.map(({ to, label, icon: Icon, id }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={id}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                  isActive ? "bg-cyan-400/10 text-cyan-300 border border-cyan-400/20" : "text-white/70 hover:bg-white/5 hover:text-white border border-transparent"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <div className="glass p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-cyan-300" />
              <p className="mono-label !text-cyan-300/70">Powered By</p>
            </div>
            <p className="text-sm font-display">Gemini 3 Flash</p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5" data-testid="user-card">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-black font-bold" style={{ background: "linear-gradient(135deg, #FF007F, #7000FF)" }}>
              {user?.name?.[0]?.toUpperCase() || user?.full_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{user?.name || user?.full_name}</p>
              <p className="text-xs text-white/50 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} data-testid="logout-btn" className="text-white/60 hover:text-white" title="Log out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 h-14 bg-black/70 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md" style={{ background: "linear-gradient(135deg, #00E5FF, #7000FF)" }} />
          <span className="font-display text-lg">MockMind</span>
        </div>
        <button onClick={handleLogout} data-testid="mobile-logout-btn" className="text-white/70">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <main className="flex-1 min-w-0 pt-16 lg:pt-0 pb-24 lg:pb-0">
        <div className="px-6 sm:px-10 py-8 sm:py-12 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-black/80 backdrop-blur-xl border-t border-white/5 flex">
        {links.map(({ to, label, icon: Icon, id }) => (
          <NavLink key={to} to={to} data-testid={`m-${id}`} className={({ isActive }) => `flex-1 flex flex-col items-center py-3 text-xs gap-1 ${isActive ? "text-cyan-300" : "text-white/60"}`}>
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
