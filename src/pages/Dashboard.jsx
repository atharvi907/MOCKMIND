import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { TrendingUp, Target, Award, ArrowRight, BookOpen, Clock, FileText, Upload, Sparkles } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from "recharts";
import { useAuth } from "../context/AuthContext";
import { interviewApi, resumeApi } from "../lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import AIAvatar from "../components/AIAvatar";

const DOMAIN_LABEL = { dsa: "DSA", projects: "Projects", behavioral: "Behavioral" };

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total_interviews: 0, average_score: 0, by_domain: {}, timeline: [] });
  const [recent, setRecent] = useState([]);
  const [resume, setResume] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [startingResume, setStartingResume] = useState(false);
  const [resumeRole, setResumeRole] = useState("Software Engineer");
  const [resumeDifficulty, setResumeDifficulty] = useState("medium");
  const [resumeQuestions, setResumeQuestions] = useState(5);
  const [resumeSecurityAccepted, setResumeSecurityAccepted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    interviewApi.stats().then(setStats).catch(() => {});
    interviewApi.list().then((r) => setRecent((r.items || []).slice(0, 4))).catch(() => {});
    resumeApi.status().then((result) => setResume(result.resume)).catch(() => {});
  }, [user]);

  const uploadResume = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) return toast.error("Please choose a PDF resume.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Please choose a PDF smaller than 5 MB.");
    setUploadingResume(true);
    try {
      const result = await resumeApi.upload(file);
      setResume(result.resume);
      toast.success("Resume uploaded and prepared for interview questions.");
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Resume upload failed. Confirm the backend is running, then try again.");
    }
    finally { setUploadingResume(false); }
  };

  const startResumeInterview = async () => {
    if (!resume?.ready) return toast.error("Upload a readable PDF resume first.");
    if (!resumeSecurityAccepted) return toast.error("Please acknowledge Secure Interview Mode before starting.");
    setStartingResume(true);
    try {
      const result = await interviewApi.start({ domain: "resume", difficulty: resumeDifficulty, role: resumeRole, interview_type: "resume", question_count: Number(resumeQuestions) });
      navigate(`/interview/${result.session_id}`, { state: { firstQuestion: result.question, domain: "resume", interviewType: "resume" } });
    } catch (error) { toast.error(error?.response?.data?.detail || "Could not start your resume-based interview."); }
    finally { setStartingResume(false); }
  };

  const userName = user?.name || user?.full_name || "Developer";

  const cards = [
    { label: "My Interviews", value: stats.total_interviews, icon: Target, color: "#00E5FF" },
    { label: "Avg Score", value: stats.average_score || 0, suffix: "/100", icon: Award, color: "#7000FF" },
    { label: "Question Bank", value: stats.question_count || 0, icon: BookOpen, color: "#FF007F" },
    { label: "Avg Answer Time", value: formatTime(stats.average_answer_time_sec || 0), icon: Clock, color: "#00FF66" },
  ];

  const domainData = Object.entries(stats.by_domain || {}).map(([k, v]) => ({ domain: DOMAIN_LABEL[k] || k, score: v }));
  const timeline = (stats.timeline || []).map((t, i) => ({ ...t, idx: i + 1 }));

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div>
            <p className="mono-label mb-3">Console</p>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tighter">
              Welcome back, <span className="neon-text">{userName.split(" ")[0]}</span>
            </h1>
            <p className="text-white/60 mt-3">Pick up where you left off. Your AI interviewer is warmed up.</p>
          </div>
          <Link to="/domains" data-testid="dash-start-btn" className="btn-primary inline-flex items-center gap-2 w-fit">
            Start new interview <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="glass glass-hover p-5 cursor-default"
              data-testid={`stat-${c.label.replace(/ /g, '-').toLowerCase()}`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: c.color + "20", border: `1px solid ${c.color}40` }}>
                  <c.icon className="w-5 h-5" style={{ color: c.color }} />
                </div>
              </div>
              <p className="mono-label">{c.label}</p>
              <p className="font-display text-3xl mt-2">
                {c.value}
                {c.suffix && <span className="text-white/40 text-xl">{c.suffix}</span>}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          <Link to="/domains" className="btn-primary">Start New Interview</Link>
          <Link to="/question-bank" className="btn-ghost">Question Bank</Link>
          <Link to="/history" className="btn-ghost">Interview History</Link>
          <a href="#performance" className="btn-ghost">View Performance</a>
        </div>

        <section className="glass p-6 mb-8 border border-fuchsia-400/20" data-testid="resume-interview-card">
          <div className="flex flex-col lg:flex-row gap-6 justify-between">
            <div className="max-w-2xl"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-fuchsia-400/10 border border-fuchsia-400/30 flex items-center justify-center"><FileText className="w-5 h-5 text-fuchsia-300" /></div><div><p className="mono-label text-fuchsia-300">Personalized interview</p><h2 className="font-display text-2xl">Interview from My Resume</h2></div></div><p className="text-white/65 text-sm mt-4">Upload your resume and let MockMind create questions from your projects, skills, experience and technologies.</p>
              {resume?.ready && <p className="mt-4 text-sm text-emerald-200">✓ Resume uploaded · {resume.filename} · {resume.summary?.project_count || 0} projects and {resume.summary?.skill_count || 0} skills identified</p>}
            </div>
            <label className="btn-ghost inline-flex items-center justify-center gap-2 h-fit cursor-pointer"><Upload className="w-4 h-4" />{uploadingResume ? "Reading PDF..." : resume?.ready ? "Replace Resume" : "Upload Resume"}<input aria-label="Upload PDF resume" type="file" accept="application/pdf,.pdf" onChange={uploadResume} disabled={uploadingResume} className="hidden" /></label>
          </div>
          {resume?.ready && <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10"><label><span className="mono-label block mb-2">Target Role</span><input className="input-dark" value={resumeRole} onChange={(e) => setResumeRole(e.target.value)} /></label><label><span className="mono-label block mb-2">Difficulty</span><select className="input-dark" value={resumeDifficulty} onChange={(e) => setResumeDifficulty(e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><label><span className="mono-label block mb-2">Questions</span><select className="input-dark" value={resumeQuestions} onChange={(e) => setResumeQuestions(e.target.value)}><option value="3">3</option><option value="5">5</option><option value="7">7</option></select></label></div>}
          {resume?.ready && <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mt-5"><label className="text-sm text-white/75 flex gap-2 items-start"><input type="checkbox" checked={resumeSecurityAccepted} onChange={(e) => setResumeSecurityAccepted(e.target.checked)} className="mt-1 accent-cyan-400" />I understand Secure Interview Mode applies after the preparation countdown.</label><button onClick={startResumeInterview} disabled={startingResume} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"><Sparkles className="w-4 h-4" />{startingResume ? "Starting..." : "Start Resume-Based Interview"}</button></div>}
        </section>

        {/* Charts */}
        <div id="performance" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="glass p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="mono-label">Performance Trend</p>
                <h3 className="font-display text-xl mt-1">Score over last interviews</h3>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline.length ? timeline : [{ idx: 1, score: 0 }]}>
                  <defs>
                    <linearGradient id="lineG" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#00E5FF" />
                      <stop offset="100%" stopColor="#7000FF" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="idx" stroke="#8A8A9E" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} stroke="#8A8A9E" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#0D0D14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} />
                  <Line type="monotone" dataKey="score" stroke="url(#lineG)" strokeWidth={3} dot={{ r: 4, fill: "#00E5FF" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass p-6">
            <p className="mono-label">By Domain</p>
            <h3 className="font-display text-xl mt-1 mb-4">Average score</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={domainData.length ? domainData : [{ domain: "N/A", score: 0 }]}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="domain" stroke="#8A8A9E" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} stroke="#8A8A9E" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#0D0D14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]} fill="#00E5FF" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent + Avatar banner */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass p-6 lg:col-span-2">
            <p className="mono-label">Recent Sessions</p>
            <h3 className="font-display text-xl mt-1 mb-5">Your last interviews</h3>
            {recent.length === 0 ? (
              <div className="text-white/50 text-sm py-8 text-center">No interviews yet. Start your first one →</div>
            ) : (
              <div className="space-y-3">
                {recent.map((s) => (
                  <Link
                    key={s.id}
                    to={`/feedback/${s.id}`}
                    data-testid={`recent-${s.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border border-white/5 hover:border-cyan-400/30 transition-colors"
                  >
                    <div>
                      <p className="font-medium capitalize">{DOMAIN_LABEL[s.domain] || s.domain}</p>
                      <p className="text-xs text-white/50 font-mono">{(s.started_at || "").slice(0, 10)} · {s.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-2xl text-cyan-300">{s.analysis?.overall_score ?? "N/A"}</p>
                      <p className="mono-label">score</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="glass p-6 flex flex-col items-center text-center">
            <div className="float"><AIAvatar size={180} /></div>
            <h4 className="font-display text-xl mt-6">Ready when you are</h4>
            <p className="text-white/60 text-sm mt-2 mb-5">Your AI interviewer is standing by.</p>
            <Link to="/domains" data-testid="avatar-start-btn" className="btn-ghost text-sm">Choose a domain</Link>
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}

function bestDomain(byDomain) {
  const entries = Object.entries(byDomain || {}).filter(([domain, score]) =>
    domain && String(domain).trim() && score !== null && score !== undefined && score !== ""
  );
  if (!entries.length) return "N/A";
  entries.sort((a, b) => b[1] - a[1]);
  return DOMAIN_LABEL[entries[0][0]] || entries[0][0];
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
