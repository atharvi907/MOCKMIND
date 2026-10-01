import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, ChevronRight, Clock } from "lucide-react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { interviewApi } from "../lib/api";

const DOMAIN_LABEL = { dsa: "DSA", projects: "Projects", behavioral: "Behavioral" };
const DOMAIN_COLOR = { dsa: "#00E5FF", projects: "#7000FF", behavioral: "#FF007F" };

export default function History() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user) return;
    interviewApi.list().then((r) => setItems(r.items || [])).catch(() => {});
  }, [user]);

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <p className="mono-label mb-3">Archive</p>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tighter mb-3">
          Interview <span className="neon-text">history</span>
        </h1>
        <p className="text-white/60 mb-10">Every session, every score — track your progression over time.</p>

        {items.length === 0 ? (
          <div className="glass p-16 text-center">
            <p className="text-white/60 mb-4">No interviews yet</p>
            <Link to="/domains" className="btn-primary inline-block" data-testid="history-start-btn">Start your first one</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  to={`/interview-history/${s.id}`}
                  data-testid={`history-item-${s.id}`}
                  className="glass glass-hover p-5 flex items-center gap-4 hover:-translate-y-0.5 transition-all"
                >
                  <div className="w-1 h-12 rounded-full" style={{ background: DOMAIN_COLOR[s.domain] || "#fff" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-display text-lg">{s.interview_type === "resume" ? "Resume-Based Interview" : (DOMAIN_LABEL[s.domain] || s.domain)}</p>
                      <span className="mono-label">· {s.difficulty}</span>
                      {s.interview_type === "resume" && <span className="mono-label text-fuchsia-200">· resume</span>}
                      {s.status === "terminated" && <span className="mono-label text-red-300">· terminated</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/50 font-mono">
                      <Calendar className="w-3 h-3" />
                      {(s.started_at || "").slice(0, 10)}
                      <span>· {s.role}</span>
                    </div>
                    <p className="text-xs text-white/60 mt-2 inline-flex gap-1 items-center"><Clock className="w-3 h-3" /> {s.history?.filter((entry) => entry.answer).length || 0} questions · {formatTime(s.timing?.total_sec || 0)} total · avg {formatTime(s.timing?.average_sec || 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-3xl" style={{ color: DOMAIN_COLOR[s.domain] || "#fff" }}>
                      {s.status === "terminated" ? "—" : (s.analysis?.overall_score ?? "N/A")}
                    </p>
                    <p className="mono-label">{s.status === "terminated" ? "security" : "score"}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/30" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
