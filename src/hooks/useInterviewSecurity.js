import { useCallback, useEffect, useRef, useState } from "react";
import { interviewApi } from "../lib/api";

const DEDUPE_MS = 1800;
const BLUR_GRACE_MS = 1200;

const eventId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useInterviewSecurity({ sessionId, questionNumber, active }) {
  const [warning, setWarning] = useState(null);
  const [terminated, setTerminated] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const activeRef = useRef(active);
  const lastEventRef = useRef(0);
  const blurTimerRef = useRef(null);
  const fullscreenEnabledRef = useRef(false);
  const contextAttemptsRef = useRef([]);

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => () => clearTimeout(blurTimerRef.current), []);

  const restore = useCallback((security, status) => {
    const count = security?.violationCount || 0;
    setViolationCount(count);
    if (status === "terminated" || security?.terminated) setTerminated(true);
  }, []);

  const report = useCallback(async (eventType) => {
    if (!activeRef.current || !sessionId || terminated) return;
    const now = Date.now();
    if (now - lastEventRef.current < DEDUPE_MS) return;
    lastEventRef.current = now;
    try {
      const result = await interviewApi.securityEvent({
        session_id: sessionId,
        event_type: eventType,
        question_number: questionNumber,
        event_id: eventId(),
      });
      setViolationCount(result.violation_count);
      if (result.terminated) setTerminated(true);
      else if (result.warning) setWarning({ type: eventType, count: result.violation_count });
    } catch (error) {
      if (error?.response?.status === 409) setTerminated(true);
      // Do not silently turn transient network problems into a security violation.
    }
  }, [questionNumber, sessionId, terminated]);

  const enterSecureMode = useCallback(async () => {
    if (!document.documentElement.requestFullscreen) return false;
    try {
      await document.documentElement.requestFullscreen();
      fullscreenEnabledRef.current = Boolean(document.fullscreenElement);
      return fullscreenEnabledRef.current;
    } catch {
      return false;
    }
  }, []);

  const handleProtectedContextMenu = useCallback((event) => {
    event.preventDefault();
    const now = Date.now();
    contextAttemptsRef.current = contextAttemptsRef.current.filter((time) => now - time < 10000);
    contextAttemptsRef.current.push(now);
    if (contextAttemptsRef.current.length >= 2) {
      contextAttemptsRef.current = [];
      report("CONTEXT_MENU");
    }
  }, [report]);

  const handleAnswerPaste = useCallback((event) => {
    const pasted = event.clipboardData?.getData("text") || "";
    if (pasted.trim().length >= 180) report("PASTE_ATTEMPT");
  }, [report]);

  useEffect(() => {
    if (!active || terminated) return undefined;
    const isEditor = (target) => target instanceof Element && Boolean(target.closest(".monaco-editor"));
    const onVisibility = () => {
      clearTimeout(blurTimerRef.current);
      if (document.visibilityState === "hidden") {
        blurTimerRef.current = setTimeout(() => {
          if (document.visibilityState === "hidden") report("TAB_SWITCH");
        }, BLUR_GRACE_MS);
      }
    };
    const onBlur = () => {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = setTimeout(() => {
        if (!document.hasFocus() && document.visibilityState === "visible") report("WINDOW_BLUR");
      }, BLUR_GRACE_MS);
    };
    const onFocus = () => clearTimeout(blurTimerRef.current);
    const onFullscreen = () => {
      if (fullscreenEnabledRef.current && !document.fullscreenElement) {
        fullscreenEnabledRef.current = false;
        report("FULLSCREEN_EXIT");
      }
    };
    const onKeyDown = (event) => {
      if (isEditor(event.target)) return;
      const key = event.key.toLowerCase();
      const control = event.ctrlKey || event.metaKey;
      if (event.key === "PrintScreen") report("SCREENSHOT_SHORTCUT");
      else if (event.key === "F12" || (control && event.shiftKey && ["i", "j"].includes(key))) report("DEVTOOLS_SIGNAL");
      else if (control && key === "u") report("SUSPICIOUS_SHORTCUT");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      clearTimeout(blurTimerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [active, report, terminated]);

  return { warning, setWarning, terminated, violationCount, restore, report, enterSecureMode, handleProtectedContextMenu, handleAnswerPaste };
}
