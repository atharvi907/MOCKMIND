import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Mic, Code2, BarChart3, Brain } from "lucide-react";
import ParticlesBG from "../components/ParticlesBG";
import AIAvatar from "../components/AIAvatar";

export default function Landing() {
  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      <ParticlesBG />
      <div className="noise" />

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-6 sm:px-12 py-6">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00E5FF, #7000FF)" }}>
            <Brain className="w-5 h-5 text-black" />
          </div>
          <span className="font-display text-xl">MockMind</span>
        </div>
        <div className="flex gap-3">
          <Link to="/login" data-testid="landing-login-btn" className="btn-ghost">Log in</Link>
          <Link to="/signup" data-testid="landing-signup-btn" className="btn-primary">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 sm:px-12 pt-12 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center max-w-7xl mx-auto">
        <motion.div
          className="lg:col-span-7"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/5 mb-8">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span className="mono-label !text-cyan-300/80">Powered by Gemini 3 Flash</span>
          </div>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tighter font-medium mb-6">
            Train like it's<br />
            <span className="neon-text">the real thing.</span>
          </h1>

          <p className="text-lg text-white/70 max-w-xl mb-10 leading-relaxed">
            An AI interview partner that talks, listens, and evaluates you like a senior engineer.
            Practice DSA, system design, projects and behavioral rounds — get feedback that actually moves the needle.
          </p>

          <div className="flex flex-wrap gap-4 mb-16">
            <Link to="/signup" data-testid="hero-cta-btn" className="btn-primary inline-flex items-center gap-2">
              Start practicing <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/login" data-testid="hero-login-btn" className="btn-ghost">I already have an account</Link>
          </div>

          <div className="grid grid-cols-3 gap-6 max-w-lg">
            {[
              { icon: Mic, label: "Voice Interviews" },
              { icon: Code2, label: "Live Code Editor" },
              { icon: BarChart3, label: "Deep Analytics" },
            ].map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="glass p-4 text-center"
              >
                <f.icon className="w-5 h-5 text-cyan-300 mx-auto mb-2" />
                <p className="text-xs text-white/80">{f.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="lg:col-span-5 flex justify-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2 }}
        >
          <div className="relative">
            <div className="float">
              <AIAvatar size={340} speaking />
            </div>
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 glass px-5 py-2 whitespace-nowrap">
              <p className="mono-label">Interviewer · Live</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stats strip */}
      <section className="relative z-10 border-y border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/5">
          {[
            { n: "3", l: "Interview Domains" },
            { n: "5", l: "Questions per Round" },
            { n: "Live", l: "Voice & Text Input" },
            { n: "AI", l: "Performance Reports" },
          ].map((s) => (
            <div key={s.l} className="px-6 py-8 text-center">
              <p className="font-mono text-3xl font-semibold text-cyan-300">{s.n}</p>
              <p className="mono-label mt-2">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 py-10 text-center text-xs text-white/40">
        © 2026 MockMind · Built for the future of interviews
      </footer>
    </div>
  );
}
