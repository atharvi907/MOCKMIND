import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { Mic, MicOff, Send, Play, Square, Timer, Volume2, Code2, MessageSquare, Brain, ShieldCheck, Maximize2, AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import AIAvatar from "../components/AIAvatar";
import ParticlesBG from "../components/ParticlesBG";
import { interviewApi, codeApi } from "../lib/api";
import { useInterviewSecurity } from "../hooks/useInterviewSecurity";

const LANG_BOILER = {
  python: `# Write your solution here
def solution():
    pass

if __name__ == '__main__':
    solution()
`,
  java: `public class Main {
  public static void main(String[] args) {
    System.out.println("Hello");
  }
}
`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
  cout << "Hello";
  return 0;
}
`,
};

const FILLERS = ["um", "uh", "like", "you know", "basically", "actually", "so"];

export default function Interview() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [questionData, setQuestionData] = useState(location.state?.firstQuestion || null);
  const [question, setQuestion] = useState(location.state?.firstQuestion?.question || location.state?.firstQuestion || "");
  const [loadingQuestion, setLoadingQuestion] = useState(!location.state?.firstQuestion);
  const [qNum, setQNum] = useState(1);
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState("text"); // text | code
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(LANG_BOILER.python);
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [timer, setTimer] = useState(0);
  const [finished, setFinished] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [professorReview, setProfessorReview] = useState(null);
  const [pendingNext, setPendingNext] = useState(null);
  const [preparingNext, setPreparingNext] = useState(false);
  const [analysis, setAnalysis] = useState({ confidence: 0, clarity: 0, depth: 0, fillers: 0 });
  const [mistakeAnalysis, setMistakeAnalysis] = useState(null);
  const security = useInterviewSecurity({ sessionId: id, questionNumber: qNum, active: interviewStarted && !finished && !professorReview });

  const recRef = useRef(null);
  const nextRequestRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const domainRef = useRef(location.state?.domain || "");
  const timerKey = `mm_interview_${id}_question_start`;

  const beginQuestionTimer = () => {
    const now = Date.now();
    startTimeRef.current = now;
    sessionStorage.setItem(timerKey, String(now));
    setTimer(0);
  };

  // The display is derived from a timestamp, rather than incrementing a counter,
  // so it remains accurate after tab throttling and a supported page refresh.
  useEffect(() => {
    if (!interviewStarted) return undefined;
    const saved = Number(sessionStorage.getItem(timerKey));
    if (saved > 0) startTimeRef.current = saved;
    else sessionStorage.setItem(timerKey, String(startTimeRef.current));
    const updateTimer = () => setTimer(Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000)));
    updateTimer();
    const i = setInterval(updateTimer, 1000);
    return () => clearInterval(i);
  }, [timerKey, interviewStarted]);

  // Load session if no state (e.g. page refresh)
  useEffect(() => {
    if (location.state?.firstQuestion) return;
    setLoadingQuestion(true);
    interviewApi
      .get(id)
      .then((s) => {
        const last = s.history?.[s.history.length - 1];
        if (last?.question) { setQuestion(last.question); setQuestionData(last); }
        security.restore(s.security, s.status);
        domainRef.current = s.domain;
        setQNum(s.history?.length || 1);
      })
      .catch(() => {
        toast.error("Interview session not found or access denied");
        navigate("/domains", { replace: true });
      })
      .finally(() => setLoadingQuestion(false));
  }, [id, location.state, navigate]);

  useEffect(() => {
    setMode(questionData?.questionType === "coding" ? "code" : "text");
  }, [questionData]);

  useEffect(() => {
    if (loadingQuestion || !questionData || interviewStarted || finished) return undefined;
    if (countdown > 0) {
      const timerId = setTimeout(() => setCountdown((value) => value - 1), 1000);
      return () => clearTimeout(timerId);
    }
    const startId = setTimeout(() => {
      beginQuestionTimer();
      setInterviewStarted(true);
    }, 700);
    return () => clearTimeout(startId);
  }, [loadingQuestion, questionData, interviewStarted, finished, countdown]);

  // TTS: speak question when it changes
  useEffect(() => {
    if (!question || finished || loadingQuestion || !interviewStarted) return;
    speak(question);
  }, [question, finished, loadingQuestion]);

  // Live analysis heuristic as user types/speaks
  useEffect(() => {
    if (!answer.trim()) {
      setAnalysis({ confidence: 0, clarity: 0, depth: 0, fillers: 0 });
      return;
    }

    const words = answer.trim().split(/\s+/).filter(Boolean);
    const len = words.length;
    const fillerCount = FILLERS.reduce((acc, f) => acc + (answer.toLowerCase().match(new RegExp(`\\b${f}\\b`, "g"))?.length || 0), 0);
    const clarity = Math.min(100, Math.round(Math.max(0, 100 - fillerCount * 8) * (len > 30 ? 1 : Math.max(0.3, len / 30))));
    const depth = Math.min(100, Math.round(len * 1.2));
    const confidence = Math.min(100, Math.round(Math.max(20, 100 - fillerCount * 6 + (len > 60 ? 10 : 0))));
    setAnalysis({ confidence, clarity, depth, fillers: fillerCount });
  }, [answer]);

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0; u.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => /female|samantha|google.+en/i.test(v.name)) || voices[0];
    if (preferred) u.voice = preferred;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  const toggleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Your browser does not support Speech Recognition. Try Google Chrome.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let finalText = answer ? answer + " " : "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + " ";
        else interim += t;
      }
      setAnswer((finalText + interim).trimStart());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  };

  const ensureNextQuestion = async () => {
    if (pendingNext) return pendingNext;
    if (!nextRequestRef.current) {
      setPreparingNext(true);
      nextRequestRef.current = interviewApi.next({ session_id: id }).then((result) => {
        setPendingNext(result);
        return result;
      }).finally(() => { setPreparingNext(false); nextRequestRef.current = null; });
    }
    return nextRequestRef.current;
  };

  const submitAnswer = async () => {
    if (!interviewStarted || professorReview || security.terminated) return;
    const isCoding = questionData?.questionType === "coding";
    if (isCoding ? !code.trim() : !answer.trim()) {
      toast.error("Please enter or record an answer first.");
      return;
    }
    setSubmitting(true);
    window.speechSynthesis?.cancel();
    try {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const payload = isCoding ? { session_id: id, answer: "", code, language, time_taken_sec: elapsed } : { session_id: id, answer: mode === "code" ? `${answer}\n\n[CODE - ${language}]\n${code}` : answer, time_taken_sec: elapsed };
      const res = await interviewApi.answer(payload);
      setMistakeAnalysis(res.mistake_analysis || null);
      setProfessorReview({ ...res.mistake_analysis, done: res.done });
      if (!res.done) ensureNextQuestion().catch(() => toast.error("The next question could not be prepared yet. You can retry."));
    } catch (e) {
      if (e?.response?.status === 409) security.restore({ terminated: true }, "terminated");
      const detail = e?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(x => x.msg).join(" ") : (typeof detail === "string" ? detail : (e?.message || "Failed to submit answer"));
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const continueAfterReview = async () => {
    if (!professorReview) return;
    if (professorReview.done) {
      setSubmitting(true);
      try {
        const fin = await interviewApi.finish({ session_id: id });
        sessionStorage.removeItem(timerKey);
        navigate(`/feedback/${id}`, { state: { analysis: fin.analysis } });
      } catch (error) { toast.error(error?.response?.data?.detail || "Could not finish the interview. Please try again."); }
      finally { setSubmitting(false); }
      return;
    }
    try {
      const next = pendingNext || await ensureNextQuestion();
      if (!next?.question) throw new Error("No next question returned");
      setQuestionData(next.question);
      setQuestion(next.question.question || next.question.problem_statement || "");
      setQNum(next.question_number);
      setAnswer(""); setOutput(""); setProfessorReview(null); setPendingNext(null); setMistakeAnalysis(null);
      beginQuestionTimer();
    } catch { toast.error("We could not prepare the next question. Please retry."); }
  };

  const runCode = async () => {
    if (!interviewStarted || security.terminated) return;
    setRunning(true); setOutput("Compiling and executing...");
    try {
      const res = await codeApi.run({ language, code, session_id: questionData?.questionType === "coding" ? id : undefined });
      const result = res.passed !== undefined ? `\n\nTests passed: ${res.passed}/${res.total} · Score: ${res.score}%` : "";
      setOutput((res.stdout || "") + (res.stderr ? `\n[stderr]\n${res.stderr}` : "") + result);
    } catch (err) {
      if (err?.response?.status === 409) security.restore({ terminated: true }, "terminated");
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Error executing code on backend.";
      setOutput(`Execution error: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  const endEarly = async () => {
    if (!interviewStarted || security.terminated) return;
    setFinished(true);
    window.speechSynthesis?.cancel();
    try {
      if (answer.trim() || (questionData?.questionType === "coding" && code.trim())) {
        const isCoding = questionData?.questionType === "coding";
        const payload = isCoding ? { session_id: id, answer: "", code, language, time_taken_sec: Math.floor((Date.now() - startTimeRef.current) / 1000) } : { session_id: id, answer: mode === "code" ? `${answer}\n\n[CODE - ${language}]\n${code}` : answer, time_taken_sec: Math.floor((Date.now() - startTimeRef.current) / 1000) };
        await interviewApi.answer(payload);
      }
      const fin = await interviewApi.finish({ session_id: id });
      sessionStorage.removeItem(timerKey);
      navigate(`/feedback/${id}`, { state: { analysis: fin.analysis } });
    } catch (error) {
      if (error?.response?.status === 409) {
        security.restore({ terminated: true }, "terminated");
        return;
      }
      navigate(`/feedback/${id}`);
    }
  };

  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (loadingQuestion) {
    return (
      <div className="relative min-h-screen text-white flex items-center justify-center">
        <ParticlesBG />
        <div className="relative z-10 text-center">
          <div className="float mb-6"><AIAvatar size={180} /></div>
          <p className="mono-label mb-2">Preparing interview</p>
          <p className="font-display text-xl">Loading your interview question...</p>
        </div>
      </div>
    );
  }

  if (!interviewStarted) return <CountdownScreen seconds={countdown} />;

  if (security.terminated) return <TerminationScreen />;

  return (
    <div className="relative min-h-screen text-white">
      <ParticlesBG />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/50 backdrop-blur-xl">
          <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00E5FF, #7000FF)" }}>
            <Brain className="w-4 h-4 text-black" />
          </div>
          <div>
            <p className="mono-label">Question {qNum} · {domainRef.current?.toUpperCase()}</p>
            <p className="font-display text-sm">Live Interview</p>
          </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/5 text-cyan-200 text-xs font-mono" data-testid="secure-mode-indicator"><ShieldCheck className="w-4 h-4" /> Secure interview</div>
          <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-black/50">
            <Timer className="w-4 h-4 text-cyan-300" />
            <span className="font-mono text-sm" data-testid="timer-display">{mmss(timer)}</span>
          </div>
          <button onClick={security.enterSecureMode} className="btn-ghost text-xs py-2 px-3 inline-flex items-center gap-1.5" data-testid="enter-secure-mode-btn"><Maximize2 className="w-3.5 h-3.5" /> Secure mode</button>
          <button onClick={endEarly} disabled={Boolean(professorReview)} data-testid="end-early-btn" className="btn-ghost text-sm py-2 px-3 disabled:opacity-40">End</button>
        </div>
      </header>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-5 gap-6 p-6">
        {/* LEFT - Avatar / Question */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="glass p-6 flex-1 flex flex-col items-center text-center min-h-[320px]">
            <div className="float mb-6"><AIAvatar speaking={speaking} size={220} /></div>
            <p className="mono-label mb-3">Interviewer</p>
            <AnimatePresence mode="wait">
              <motion.div
                key={question}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="font-display text-xl leading-snug text-white"
                data-testid="current-question"
                onCopy={() => security.report("COPY_ATTEMPT")}
                onCut={() => security.report("CUT_ATTEMPT")}
                onContextMenu={security.handleProtectedContextMenu}
              >
                {questionData?.questionType === "coding" ? <CodingPrompt data={questionData} /> : question}
              </motion.div>
            </AnimatePresence>
            <button onClick={() => speak(questionData?.questionType === "coding" ? questionData.problem_statement : question)} data-testid="replay-btn" className="mt-5 text-xs inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200">
              <Volume2 className="w-3.5 h-3.5" /> Replay question
            </button>
          </div>

          {/* Live analysis */}
          <div className="glass p-5">
            <p className="mono-label mb-4">Live Analysis</p>
            <div className="space-y-3">
              <Bar label="Confidence" value={analysis.confidence} color="#00E5FF" />
              <Bar label="Clarity" value={analysis.clarity} color="#7000FF" />
              <Bar label="Technical Depth" value={analysis.depth} color="#FF007F" />
              <div className="flex justify-between text-sm pt-2">
                <span className="text-white/60">Filler words</span>
                <span className="font-mono text-white" data-testid="filler-count">{analysis.fillers}</span>
              </div>
            </div>
            {mistakeAnalysis && <div className="mt-5 pt-5 border-t border-white/10" data-testid="mistake-analysis"><p className="mono-label text-fuchsia-300 mb-2">Mistake Analysis</p><p className="font-display text-sm capitalize">{mistakeAnalysis.status?.replaceAll("_", " ")}</p>{mistakeAnalysis.mistakes?.map((m, index) => <div className="mt-3 text-sm text-white/75" key={index}><p className="text-red-200">{m.type}: {m.what_went_wrong}</p><p className="mt-1">{m.why_wrong}</p><p className="mt-1 text-cyan-200">Better answer: {m.better_answer}</p></div>)}{!mistakeAnalysis.mistakes?.length && <p className="text-sm text-white/70 mt-2">{mistakeAnalysis.what_went_well || mistakeAnalysis.small_improvement}</p>}</div>}
          </div>
        </div>

        {/* RIGHT - Answer area */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="glass p-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1 p-1 rounded-lg bg-black/50 border border-white/10">
                <button disabled={questionData?.questionType === "coding"} onClick={() => setMode("text")} data-testid="mode-text" className={`px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-2 ${mode === "text" ? "bg-white/10 text-white" : "text-white/60"}`}>
                  <MessageSquare className="w-3.5 h-3.5" /> Answer
                </button>
                <button disabled={questionData?.questionType === "coding"} onClick={() => setMode("code")} data-testid="mode-code" className={`px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-2 ${mode === "code" ? "bg-white/10 text-white" : "text-white/60"}`}>
                  <Code2 className="w-3.5 h-3.5" /> Code
                </button>
              </div>
              <button
                onClick={toggleMic}
                disabled={Boolean(professorReview)}
                data-testid="mic-btn"
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  listening ? "border-fuchsia-400/60 bg-fuchsia-400/10 text-fuchsia-300 pulse-ring" : "border-white/10 hover:border-cyan-400/40"
                }`}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {listening ? "Stop" : "Speak"}
              </button>
            </div>

            {mode === "text" ? (
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onPaste={security.handleAnswerPaste}
                disabled={Boolean(professorReview)}
                placeholder="Start typing or hit the mic to speak your answer..."
                className="input-dark flex-1 min-h-[280px] font-body resize-none"
                data-testid="answer-textarea"
              />
            ) : (
              <div className="flex-1 flex flex-col gap-3 min-h-[280px]">
                <div className="flex items-center justify-between">
                  <select
                    value={language}
                    onChange={(e) => { setLanguage(e.target.value); setCode(LANG_BOILER[e.target.value]); }} disabled={Boolean(professorReview)}
                    data-testid="lang-select"
                    className="input-dark !w-auto text-sm py-2"
                  >
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                  </select>
                  <button onClick={runCode} disabled={running || Boolean(professorReview)} data-testid="run-code-btn" className="btn-ghost text-sm py-2 inline-flex items-center gap-2">
                    {running ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {running ? "Running..." : "Run"}
                  </button>
                </div>
                <div className="flex-1 rounded-lg overflow-hidden border border-white/10 min-h-[220px]">
                  <Editor
                    height="260px"
                    language={language === "cpp" ? "cpp" : language}
                    value={code}
                    onChange={(v) => !professorReview && setCode(v || "")}
                    theme="vs-dark"
                    options={{ fontSize: 13, fontFamily: "Azeret Mono", minimap: { enabled: false }, scrollBeyondLastLine: false }}
                  />
                </div>
                <div className="rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-xs text-white/80 min-h-[70px] whitespace-pre-wrap" data-testid="code-output">
                  {output || <span className="text-white/40">Output will appear here</span>}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={submitAnswer}
            disabled={submitting || Boolean(professorReview)}
            data-testid="submit-answer-btn"
            className="btn-primary inline-flex items-center justify-center gap-2 w-full text-base py-4"
          >
            {submitting ? "Analyzing..." : qNum >= 5 ? "Finish Interview" : "Submit & Next Question"}
            {!submitting && <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {professorReview && <ProfessorReview review={professorReview} loadingNext={preparingNext} onContinue={continueAfterReview} submitting={submitting} />}
      {security.warning && <SecurityWarning warning={security.warning} onContinue={() => security.setWarning(null)} />}
    </div>
  );
}

function CountdownScreen({ seconds }) {
  return <div className="relative min-h-screen text-white flex items-center justify-center p-6"><ParticlesBG /><motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 glass max-w-lg w-full p-10 text-center border border-cyan-400/25"><ShieldCheck className="w-10 h-10 text-cyan-300 mx-auto mb-5" /><p className="mono-label text-cyan-200">Secure Mode</p><h1 className="font-display text-3xl mt-3">Get ready</h1><p className="font-display text-8xl neon-text mt-5 tabular-nums">{seconds > 0 ? seconds : "…"}</p><p className="text-white/70 mt-6">{seconds > 0 ? "Your interview is about to begin. Prepare yourself..." : "Interview Starting..."}</p><p className="text-xs text-white/45 mt-5">Your answer timer and secure monitoring begin with Question 1.</p></motion.div></div>;
}

function ProfessorReview({ review, loadingNext, onContinue, submitting }) {
  const rows = [
    ["What you did well", review.what_went_well, "text-emerald-200"],
    ["What is missing", review.missing_information, "text-amber-100"],
    ["Technical mistake", review.technical_mistake, "text-red-200"],
    ["How to improve", review.how_to_improve, "text-cyan-100"],
    ["Correct explanation", review.correct_explanation, "text-white/80"],
    ["Recommended answer", review.better_answer, "text-fuchsia-100"],
  ].filter(([, value]) => value);
  return <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm overflow-y-auto p-4 sm:p-8 flex items-center justify-center" role="dialog" aria-modal="true" data-testid="professor-review"><div className="glass max-w-3xl w-full p-6 sm:p-8 border border-fuchsia-400/30"><div className="flex items-start gap-4"><CheckCircle2 className="w-8 h-8 text-fuchsia-300 shrink-0" /><div><p className="mono-label text-fuchsia-300">Professor Review</p><h2 className="font-display text-2xl mt-1">Status: {review.status_label || review.status?.replaceAll("_", " ")}</h2><p className="text-cyan-200 font-mono mt-2">Score: {review.score ?? "—"}/100</p></div></div><div className="mt-6 space-y-4">{rows.map(([title, value, color]) => <section key={title} className="rounded-lg border border-white/10 bg-black/25 p-4"><p className="mono-label mb-2">{title}</p><p className={`text-sm leading-relaxed whitespace-pre-wrap ${color}`}>{value}</p></section>)}</div>{review.improvement_tip && <div className="mt-4 flex gap-3 text-sm text-amber-100"><Lightbulb className="w-4 h-4 shrink-0 mt-0.5" /><p><b>Concise tip:</b> {review.improvement_tip}</p></div>}<button onClick={onContinue} disabled={submitting} className="btn-primary w-full mt-7 disabled:opacity-50">{submitting ? "Finishing..." : review.done ? "View Final Feedback" : loadingNext ? "Preparing next question..." : "Continue to Next Question"}</button></div></div>;
}

function Bar({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-white/70">{label}</span>
        <span className="font-mono text-white">{value}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  );
}

function CodingPrompt({ data }) {
  return <div className="text-left"><p className="mono-label text-cyan-300">Coding Challenge · {data.difficulty}</p><h2 className="mt-2">{data.title}</h2><p className="font-body text-sm text-white/80 mt-3">{data.problem_statement}</p><div className="font-body text-xs text-white/65 mt-4 space-y-2"><p><b>Input:</b> {data.input_format}</p><p><b>Output:</b> {data.output_format}</p><p><b>Constraints:</b> {data.constraints}</p>{data.examples?.[0] && <p><b>Example:</b> {data.examples[0].input} → {data.examples[0].output}</p>}</div></div>;
}

function SecurityWarning({ warning, onContinue }) {
  const label = warning.type === "SCREENSHOT_SHORTCUT" ? "A screenshot-related keyboard action" : "Suspicious activity";
  return <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-5" role="dialog" aria-modal="true" data-testid="security-warning-modal"><div className="glass max-w-lg w-full p-8 border border-amber-400/40"><AlertTriangle className="w-9 h-9 text-amber-300 mb-5" /><p className="mono-label text-amber-200">Security Warning</p><h2 className="font-display text-2xl mt-2">{label} was detected.</h2><p className="text-white/70 mt-4 leading-relaxed">Please remain on the interview screen and avoid external resources, copying protected interview content, or attempts to capture questions. This is your first and only warning.</p><p className="font-mono text-amber-200 mt-5">Violations: {warning.count} / 2</p><button onClick={onContinue} className="btn-primary w-full mt-7">Continue interview</button></div></div>;
}

function TerminationScreen() {
  const navigate = useNavigate();
  return <div className="relative min-h-screen text-white flex items-center justify-center p-6"><ParticlesBG /><div className="relative z-10 glass max-w-xl w-full p-10 text-center border border-red-400/35" data-testid="security-termination-screen"><AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-5" /><p className="mono-label text-red-200">Interview Terminated</p><h1 className="font-display text-3xl mt-3">Security violation detected</h1><p className="text-white/70 mt-5 leading-relaxed">Two security violations were detected during this interview. For interview integrity, this session has been cancelled and cannot receive a normal score.</p><p className="font-mono text-red-200 mt-6">TERMINATED — SECURITY VIOLATION</p><button onClick={() => navigate("/dashboard", { replace: true })} className="btn-primary mt-8">Return to dashboard</button></div></div>;
}
