import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, ArrowLeft } from "lucide-react";
import AppShell from "../components/AppShell";
import { interviewApi } from "../lib/api";

const fmt = (s = 0) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function InterviewDetail() {
  const { id } = useParams();
  const [session, setSession] = useState(null); const [error, setError] = useState("");
  useEffect(() => { interviewApi.get(id).then(setSession).catch((e) => setError(e?.response?.data?.detail || "Interview not found or access denied.")); }, [id]);
  if (error) return <AppShell><div className="glass p-10 text-center text-red-200">{error}<div className="mt-5"><Link className="btn-ghost" to="/history">Back to history</Link></div></div></AppShell>;
  if (!session) return <AppShell><div className="glass p-12 text-center text-white/50">Loading interview details…</div></AppShell>;
  return <AppShell>
    <Link to="/history" className="text-cyan-300 inline-flex items-center gap-2 text-sm mb-6"><ArrowLeft className="w-4 h-4" /> Interview history</Link>
    <p className="mono-label mb-3">Interview overview</p><h1 className="font-display text-4xl"><span className="neon-text">{session.domain?.toUpperCase()}</span> Interview</h1>
    <div className="glass p-5 grid grid-cols-2 lg:grid-cols-5 gap-5 mt-6 mb-8 text-sm"><div><p className="mono-label">Role</p><p className="mt-1">{session.role}</p></div><div><p className="mono-label">Difficulty</p><p className="mt-1 capitalize">{session.difficulty}</p></div><div><p className="mono-label">Date</p><p className="mt-1">{session.started_at?.slice(0, 10)}</p></div><div><p className="mono-label">Overall score</p><p className={`mt-1 font-mono ${session.status === "terminated" ? "text-red-300" : "text-cyan-300"}`}>{session.status === "terminated" ? "Not scored" : `${session.score ?? "N/A"}/100`}</p></div><div><p className="mono-label">Total time</p><p className="mt-1 font-mono">{fmt(session.timing?.total_sec)}</p></div></div>
    {session.status === "terminated" && <section className="glass p-6 mb-8 border border-red-400/30"><p className="mono-label text-red-300">Interview status</p><h2 className="font-display text-2xl mt-2">Terminated — Security violation</h2><p className="text-white/65 mt-3">This session was not normally completed and has no interview score.</p>{session.security?.events?.length > 0 && <div className="mt-5 space-y-2 text-sm text-white/75">{session.security.events.map((event, index) => <p key={event.eventId || index}>{index + 1}. {event.label || "Security activity detected"} · Question {event.questionNumber}</p>)}</div>}</section>}
    <h2 className="font-display text-2xl mb-4">Questions</h2><div className="space-y-4">{(session.history || []).map((entry, index) => <article className="glass p-6" key={index}><div className="flex justify-between gap-4"><div><p className="mono-label text-cyan-300">{entry.questionType === "coding" ? `Coding challenge · ${entry.difficulty}` : "Technical question"}</p><h3 className="font-display text-lg mt-2">Q{index + 1}. {entry.question}</h3></div><span className="font-mono text-cyan-300 whitespace-nowrap inline-flex gap-1 items-center"><Clock className="w-4 h-4" />{fmt(entry.timeTakenSec)}</span></div><p className="mono-label mt-5 mb-2">Your answer</p><p className="text-white/75 whitespace-pre-wrap">{entry.answer || "Not answered"}</p>{entry.coding && <p className="mt-4 text-sm text-cyan-200">Coding result: {entry.coding.passed}/{entry.coding.total} tests · {entry.coding.score}% · {entry.coding.language}</p>}{entry.mistakeAnalysis && <section className="mt-5 pt-4 border-t border-white/10"><p className="mono-label text-fuchsia-300 mb-2">Mistake Analysis · {entry.mistakeAnalysis.status?.replaceAll("_", " ")}</p>{entry.mistakeAnalysis.mistakes?.map((mistake, mi) => <div key={mi} className="text-sm text-white/75 mt-3"><p className="text-red-200">{mistake.what_went_wrong}</p><p>{mistake.why_wrong}</p><p className="text-cyan-100">Better answer: {mistake.better_answer}</p></div>)}{!entry.mistakeAnalysis.mistakes?.length && <p className="text-sm text-white/70">{entry.mistakeAnalysis.what_went_well || entry.mistakeAnalysis.small_improvement}</p>}</section>}</article>)}</div>
  </AppShell>;
}
