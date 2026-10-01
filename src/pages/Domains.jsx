import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Binary, FolderKanban, Users, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import AppShell from "../components/AppShell";
import { interviewApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const DOMAINS = [
  {
    key: "dsa",
    title: "Data Structures & Algorithms",
    desc: "Arrays, trees, graphs, DP — the coding interview staples.",
    icon: Binary,
    grad: "from-cyan-400 to-blue-600",
    accent: "#00E5FF",
  },
  {
    key: "projects",
    title: "Projects & Systems",
    desc: "Deep-dive into your past work, architecture and trade-offs.",
    icon: FolderKanban,
    grad: "from-violet-500 to-fuchsia-500",
    accent: "#7000FF",
  },
  {
    key: "behavioral",
    title: "Behavioral",
    desc: "STAR stories, leadership, conflict and culture fit.",
    icon: Users,
    grad: "from-pink-500 to-rose-500",
    accent: "#FF007F",
  },
];

function TiltCard({ d, selected, onClick }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -y * 10, ry: x * 14 });
  };
  const onLeave = () => setTilt({ rx: 0, ry: 0 });

  return (
    <motion.button
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      data-testid={`domain-card-${d.key}`}
      whileTap={{ scale: 0.98 }}
      className={`group relative text-left glass p-7 overflow-hidden ${selected ? "ring-2 ring-offset-2 ring-offset-[#05050A]" : ""}`}
      style={{
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transition: "transform 0.15s ease-out",
        boxShadow: selected ? `0 0 0 2px ${d.accent}, 0 20px 60px ${d.accent}40` : undefined,
      }}
    >
      <div
        className="absolute -top-16 -right-16 w-52 h-52 rounded-full blur-3xl opacity-40 group-hover:opacity-70 transition-opacity"
        style={{ background: d.accent }}
      />
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${d.grad} flex items-center justify-center mb-6`}>
        <d.icon className="w-6 h-6 text-black" />
      </div>
      <p className="mono-label mb-2">Domain · {d.key.toUpperCase()}</p>
      <h3 className="font-display text-2xl tracking-tight mb-3">{d.title}</h3>
      <p className="text-white/60 text-sm leading-relaxed">{d.desc}</p>
      <div className="mt-8 flex items-center justify-between text-sm">
        <span className="text-white/50">5 questions · 15 min</span>
        <span style={{ color: d.accent }} className="font-mono">Select →</span>
      </div>
    </motion.button>
  );
}

export default function Domains() {
  const [selected, setSelected] = useState(null);
  const [difficulty, setDifficulty] = useState("medium");
  const [role, setRole] = useState("Software Engineer");
  const [starting, setStarting] = useState(false);
  const [securityAcknowledged, setSecurityAcknowledged] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const start = async () => {
    if (!selected) {
      toast.error("Pick a domain first");
      return;
    }
    if (!securityAcknowledged) {
      toast.error("Please acknowledge the Secure Interview Mode notice.");
      return;
    }
    if (!user?.id && !user?._id) {
      toast.error("Please log in again to start an interview");
      navigate("/login");
      return;
    }
    setStarting(true);
    try {
      const res = await interviewApi.start({ domain: selected, difficulty, role });
      navigate(`/interview/${res.session_id}`, { state: { firstQuestion: res.question, domain: selected } });
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(x => x.msg).join(" ") : (typeof detail === "string" ? detail : (e?.message || "Could not start interview"));
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <p className="mono-label mb-3">Step 1 of 2</p>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tighter mb-3">
          Choose your <span className="neon-text">battleground</span>
        </h1>
        <p className="text-white/60 mb-10 max-w-xl">Each domain adapts the interviewer's persona, questions, and evaluation rubric.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {DOMAINS.map((d) => (
            <TiltCard key={d.key} d={d} selected={selected === d.key} onClick={() => setSelected(d.key)} />
          ))}
        </div>

        <div className="glass p-6 grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <div>
            <label className="mono-label block mb-2">Target Role</label>
            <input className="input-dark" value={role} onChange={(e) => setRole(e.target.value)} data-testid="role-input" />
          </div>
          <div>
            <label className="mono-label block mb-2">Difficulty</label>
            <div className="flex gap-2">
              {["easy", "medium", "hard"].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  data-testid={`difficulty-${d}`}
                  className={`flex-1 py-2 rounded-lg border text-sm capitalize transition-colors ${
                    difficulty === d ? "bg-cyan-400/10 border-cyan-400/50 text-cyan-300" : "border-white/10 text-white/70 hover:border-white/30"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={start}
              disabled={starting || !selected}
              data-testid="start-interview-btn"
              className="btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {starting ? "Starting..." : "Begin Interview"}
              {!starting && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="glass p-5 border border-cyan-400/20" data-testid="security-notice">
          <div className="flex gap-3"><ShieldCheck className="w-5 h-5 text-cyan-300 shrink-0 mt-0.5" /><div><p className="font-display text-lg">Secure Interview Mode</p><p className="text-sm text-white/65 mt-1">MockMind monitors browser-level signals such as tab switching, focus loss, fullscreen exits, and certain copy/paste or keyboard actions. It does not record your screen, microphone, clipboard, or other applications. Some operating-system screenshot methods cannot be reliably detected by a browser.</p><label className="flex items-start gap-3 mt-4 text-sm text-white/85 cursor-pointer"><input type="checkbox" checked={securityAcknowledged} onChange={(e) => setSecurityAcknowledged(e.target.checked)} data-testid="security-acknowledgement" className="mt-1 accent-cyan-400" /><span>I understand and agree to the Secure Interview Mode notice.</span></label></div></div>
        </div>
      </motion.div>
    </AppShell>
  );
}
