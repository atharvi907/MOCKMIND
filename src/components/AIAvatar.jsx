import { motion } from "framer-motion";

export default function AIAvatar({ speaking = false, size = 260 }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }} data-testid="ai-avatar">
      {/* outer orbit */}
      <motion.div
        className="absolute inset-0 rounded-full border border-cyan-400/30"
        animate={{ rotate: 360 }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-4 rounded-full border border-fuchsia-400/20"
        animate={{ rotate: -360 }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      />

      {/* core orb */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 0.55,
          height: size * 0.55,
          background: "radial-gradient(circle at 30% 30%, #00E5FF 0%, #7000FF 45%, #FF007F 100%)",
          filter: "blur(0.5px)",
          boxShadow: "0 0 60px rgba(0, 229, 255, 0.6), 0 0 120px rgba(112, 0, 255, 0.4)",
        }}
        animate={speaking ? { scale: [1, 1.08, 0.98, 1.05, 1] } : { scale: [1, 1.03, 1] }}
        transition={{ duration: speaking ? 0.6 : 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* inner rings when speaking */}
      {speaking && (
        <>
          <motion.div
            className="absolute rounded-full border-2 border-cyan-300/60"
            style={{ width: size * 0.7, height: size * 0.7 }}
            animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          <motion.div
            className="absolute rounded-full border-2 border-fuchsia-400/40"
            style={{ width: size * 0.7, height: size * 0.7 }}
            animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
          />
        </>
      )}

      {/* eye dots */}
      <div className="absolute flex gap-6" style={{ top: "42%" }}>
        <motion.span className="w-2 h-2 rounded-full bg-white" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 3, repeat: Infinity }} />
        <motion.span className="w-2 h-2 rounded-full bg-white" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 3, repeat: Infinity, delay: 0.1 }} />
      </div>
    </div>
  );
}
