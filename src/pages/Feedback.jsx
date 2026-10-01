import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, X, Lightbulb, ArrowRight, Trophy, Clock } from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import AppShell from "../components/AppShell";
import { interviewApi } from "../lib/api";

export default function Feedback() {
  const { id } = useParams();
  const location = useLocation();
  const [analysis, setAnalysis] = useState(location.state?.analysis || null);
  const [session, setSession] = useState(null);

  useEffect(() => {
    interviewApi.get(id).then((s) => {
      setSession(s);
      if (!analysis && s.analysis) setAnalysis(s.analysis);
    }).catch(() => {});
  }, [id]);

  if (session?.status === "terminated") {
    return <AppShell><div className="glass max-w-2xl mx-auto p-10 text-center border border-red-400/30"><p className="mono-label text-red-300">Interview status</p><h1 className="font-display text-3xl mt-3">Terminated — Security violation</h1><p className="text-white/70 mt-5">This interview was cancelled after two security violations. A normal feedback score was not generated.</p><Link to="/dashboard" className="btn-primary inline-block mt-8">Return to dashboard</Link></div></AppShell>;
  }

  if (!analysis) {
    return (
      <AppShell>
        <div className="py-24 text-center">
          <p className="mono-label mb-4">Analyzing performance...</p>
          <h2 className="font-display text-3xl">Preparing your feedback report</h2>
        </div>
      </AppShell>
    );
  }

  const radarData = [
    { metric: "Confidence", val: analysis.confidence },
    { metric: "Clarity", val: analysis.clarity },
    { metric: "Technical", val: analysis.technical_depth },
    { metric: "Communication", val: analysis.communication },
    { metric: "Depth", val: analysis.technical_depth },
  ];

  const breakdown = [
    { name: "Confidence", value: analysis.confidence, color: "#00E5FF" },
    { name: "Clarity", value: analysis.clarity, color: "#7000FF" },
    { name: "Technical Depth", value: analysis.technical_depth, color: "#FF007F" },
    { name: "Communication", value: analysis.communication, color: "#00FF66" },
  ];
  const times = (session?.history || []).filter((entry) => entry.answer).map((entry, index) => ({ name: `Q${index + 1}`, seconds: entry.timeTakenSec || 0 }));
  const timing = session?.timing || { total_sec: 0, average_sec: 0, fastest_sec: 0, slowest_sec: 0 };

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <p className="mono-label mb-3">Feedback Report</p>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tighter mb-3">
          Your <span className="neon-text">performance debrief</span>
        </h1>
        {session && (
          <p className="text-white/60 mb-8 font-mono text-sm">
            {session.domain?.toUpperCase()} · {session.difficulty} · {(session.started_at || "").slice(0, 10)}
          </p>
        )}

        {/* Overall + Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="glass p-8 flex flex-col items-center justify-center text-center">
            <Trophy className="w-10 h-10 text-cyan-300 mb-4" />
            <p className="mono-label mb-2">Overall Score</p>
            <p className="font-display text-7xl tracking-tighter neon-text" data-testid="overall-score">{analysis.overall_score}</p>
            <p className="text-white/50 mt-2">/ 100</p>
            <p className="text-white/70 mt-6 text-sm italic">"{analysis.summary}"</p>
          </div>

          <div className="glass p-6 lg:col-span-2">
            <p className="mono-label">Skill Radar</p>
            <h3 className="font-display text-xl mt-1 mb-4">Communication vs Technical</h3>
            <div className="h-72">
              <ResponsiveContainer>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#8A8A9E", fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#8A8A9E", fontSize: 10 }} stroke="rgba(255,255,255,0.1)" />
                  <Radar name="Score" dataKey="val" stroke="#00E5FF" fill="#00E5FF" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {session && <div className="glass p-6 mb-6">
          <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-cyan-300" /><div><p className="mono-label">Time performance</p><h3 className="font-display text-xl mt-1">Question-by-question pacing</h3></div></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6">{[["Total interview time", timing.total_sec], ["Average / question", timing.average_sec], ["Fastest answer", timing.fastest_sec], ["Slowest answer", timing.slowest_sec]].map(([title, seconds]) => <div key={title} className="rounded-lg bg-black/30 border border-white/5 p-4"><p className="mono-label">{title}</p><p className="font-mono text-2xl text-cyan-300 mt-2">{formatTime(seconds)}</p></div>)}</div>
          {times.length > 0 && <div className="h-48"><ResponsiveContainer><BarChart data={times}><CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} /><XAxis dataKey="name" stroke="#8A8A9E" /><YAxis stroke="#8A8A9E" /><Tooltip formatter={(value) => formatTime(value)} contentStyle={{ background: "#0D0D14", border: "1px solid rgba(255,255,255,0.1)" }} /><Bar dataKey="seconds" fill="#00E5FF" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>}
          <p className="text-white/70 text-sm mt-5">{analysis.timing_insight || "Timing is context for your preparation, not a score by itself."}</p>
        </div>}

        {/* Breakdown */}
        <div className="glass p-6 mb-6">
          <p className="mono-label">Score breakdown</p>
          <h3 className="font-display text-xl mt-1 mb-4">Metric by metric</h3>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={breakdown} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="#8A8A9E" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" stroke="#8A8A9E" tick={{ fontSize: 12 }} width={130} />
                <Tooltip contentStyle={{ background: "#0D0D14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {breakdown.map((b, i) => <Cell key={i} fill={b.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {analysis.coding_performance?.question_count > 0 && <div className="glass p-6 mb-6" data-testid="coding-performance"><p className="mono-label text-cyan-300">Coding Performance</p><h3 className="font-display text-xl mt-1">{analysis.coding_performance.question_count} coding challenge{analysis.coding_performance.question_count === 1 ? "" : "s"} · {analysis.coding_performance.overall_score}% overall</h3><div className="mt-4 space-y-2">{analysis.coding_performance.questions.map((item, index) => <p key={index} className="text-sm text-white/75"><span className={item.score >= 60 ? "text-emerald-300" : "text-red-300"}>{item.score >= 60 ? "✓" : "✗"}</span> {item.difficulty} · {item.passed}/{item.total} tests · {item.score}%</p>)}</div></div>}

        <QuestionWiseReview entries={(session?.history || []).filter((entry) => entry.answer)} fallbackReviews={analysis.question_reviews || analysis.mistake_analysis || []} />

        {analysis.mistake_analysis?.length > 0 && <div className="glass p-6 mb-6" data-testid="feedback-mistake-analysis"><p className="mono-label text-fuchsia-300">Detailed Mistake Analysis</p><h3 className="font-display text-xl mt-1 mb-5">Question-specific coaching</h3>{analysis.mistake_analysis.map((entry, index) => <div className="border-t border-white/10 pt-4 mt-4" key={index}><p className="text-sm text-white/60">Q{index + 1}. {entry.question}</p><p className="font-display text-sm capitalize mt-2">{entry.status?.replaceAll("_", " ")}</p>{entry.mistakes?.map((mistake, mi) => <div key={mi} className="mt-3 text-sm space-y-1"><p className="text-red-200"><b>Mistake:</b> {mistake.what_went_wrong}</p><p><b>Why:</b> {mistake.why_wrong}</p><p className="text-cyan-100"><b>Correct explanation:</b> {mistake.correct_explanation}</p><p><b>Better answer:</b> {mistake.better_answer}</p><p className="text-amber-100"><b>Tip:</b> {mistake.improvement_tip}</p></div>)}{!entry.mistakes?.length && <p className="text-sm text-white/75 mt-2">{entry.what_went_well || entry.small_improvement}</p>}</div>)}</div>}

        {/* Strengths / Weaknesses / Suggestions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <FeedbackList title="Strengths" icon={Check} color="#00FF66" items={analysis.strengths || []} testid="list-strengths" />
          <FeedbackList title="Weaknesses" icon={X} color="#FF3333" items={analysis.weaknesses || []} testid="list-weaknesses" />
          <FeedbackList title="Suggestions" icon={Lightbulb} color="#FFB800" items={analysis.suggestions || []} testid="list-suggestions" />
        </div>

        {/* Filler words */}
        <div className="glass p-6 flex items-center justify-between mb-10">
          <div>
            <p className="mono-label">Speech quality</p>
            <h3 className="font-display text-xl mt-1">Filler words detected</h3>
          </div>
          <p className="font-mono text-5xl text-fuchsia-300">{analysis.filler_words || 0}</p>
        </div>

        <div className="flex gap-3">
          <Link to="/domains" data-testid="retry-btn" className="btn-primary inline-flex items-center gap-2">
            Practice again <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/dashboard" className="btn-ghost">Back to dashboard</Link>
        </div>
      </motion.div>
    </AppShell>
  );
}

function QuestionWiseReview({ entries, fallbackReviews }) {
  const reviews = entries.length ? entries.map((entry, index) => ({ question: entry.question, review: entry.mistakeAnalysis, index })) : fallbackReviews.map((review, index) => ({ question: review.question, review, index }));
  if (!reviews.length) return null;
  return <section className="glass p-6 mb-6" data-testid="question-wise-review"><p className="mono-label text-fuchsia-300">Question-wise performance review</p><h3 className="font-display text-xl mt-1 mb-5">Professor feedback for every answer</h3><div className="space-y-5">{reviews.map(({ question, review, index }) => <article className="rounded-xl border border-white/10 bg-black/25 p-5" key={`${question}-${index}`}><div className="flex flex-col sm:flex-row gap-3 justify-between"><div><p className="mono-label">Question {index + 1}</p><h4 className="font-display text-lg mt-2">{question}</h4></div><div className="text-left sm:text-right"><p className="font-mono text-cyan-200">{review?.score ?? "—"}/100</p><p className="mono-label text-fuchsia-200">{review?.status_label || review?.status?.replaceAll("_", " ") || "Review unavailable"}</p></div></div>{review ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 text-sm"><ReviewCell title="What went well" value={review.what_went_well} color="text-emerald-100" /><ReviewCell title="What is missing" value={review.missing_information} color="text-amber-100" /><ReviewCell title="Technical mistake" value={review.technical_mistake} color="text-red-200" /><ReviewCell title="How to improve" value={review.how_to_improve || review.small_improvement} color="text-cyan-100" /><ReviewCell title="Correct explanation" value={review.correct_explanation} color="text-white/80" /><ReviewCell title="Better answer" value={review.better_answer} color="text-fuchsia-100" /></div> : <p className="text-sm text-white/55 mt-4">No detailed professor review is available for this older interview.</p>}{review?.improvement_tip && <p className="text-sm text-amber-100 mt-4">Tip: {review.improvement_tip}</p>}</article>)}</div></section>;
}

function ReviewCell({ title, value, color }) {
  if (!value) return null;
  return <div><p className="mono-label mb-1">{title}</p><p className={`${color} leading-relaxed whitespace-pre-wrap`}>{value}</p></div>;
}

function FeedbackList({ title, icon: Icon, color, items, testid }) {
  return (
    <div className="glass p-6" data-testid={testid}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + "20", border: `1px solid ${color}40` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <h3 className="font-display text-lg">{title}</h3>
      </div>
      <ul className="space-y-3 text-sm">
        {items.length ? items.map((it, i) => (
          <li key={i} className="text-white/80 leading-relaxed">
            <span className="text-white/40 font-mono mr-2">{String(i + 1).padStart(2, "0")}</span>
            {it}
          </li>
        )) : <li className="text-white/40">No items</li>}
      </ul>
    </div>
  );
}

function formatTime(seconds = 0) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
