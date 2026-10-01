import uuid
import re
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.config.settings import Settings, get_settings
from app.database.mongo import database
from app.dependencies.auth import current_user
from app.schemas.api import AnswerRequest, FinishRequest, InterviewStartRequest, SecurityEventRequest
from app.services.interviews import analyze_answer, evaluate, next_question
from app.utils.security import utc_now

router = APIRouter(tags=["Interviews"])
MAX_QUESTIONS = 5
logger = logging.getLogger(__name__)
SECURITY_EVENT_LABELS = {
    "TAB_SWITCH": "Left the interview tab", "WINDOW_BLUR": "Left the interview window",
    "FULLSCREEN_EXIT": "Exited secure fullscreen", "SCREENSHOT_SHORTCUT": "Screenshot-related shortcut detected",
    "COPY_ATTEMPT": "Tried to copy protected interview content", "CUT_ATTEMPT": "Tried to cut protected interview content",
    "PASTE_ATTEMPT": "Pasted a large answer", "CONTEXT_MENU": "Repeated right-click on protected content",
    "DEVTOOLS_SIGNAL": "Developer-tools shortcut detected", "SUSPICIOUS_SHORTCUT": "Suspicious keyboard shortcut detected",
}


def public_question(entry: dict) -> dict:
    """Keep generated test cases on the server while giving the UI a stable challenge schema."""
    hidden = {"test_cases", "answerQuality"}
    return {key: value for key, value in entry.items() if key not in hidden}


async def get_owned_interview(interview_id: str, user_id: str) -> dict:
    interview = await database.get_db().interviews.find_one({"_id": interview_id, "userId": user_id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview session not found")
    return interview


async def get_owned_resume(user_id: str) -> dict:
    resume = await database.get_db().resumes.find_one({"userId": user_id})
    if not resume or not resume.get("extractedText") or not resume.get("structured"):
        raise HTTPException(status_code=400, detail="Upload a readable PDF resume before starting a resume-based interview")
    return resume


def serialize(interview: dict) -> dict:
    result = dict(interview)
    result["id"] = result.pop("_id")
    result["user_id"] = result["userId"]
    result["interview_type"] = result.get("interviewType", "standard")
    result["started_at"] = result["createdAt"].isoformat()
    result["finished_at"] = result["finishedAt"].isoformat() if result.get("finishedAt") else None
    timings = [item.get("timeTakenSec", 0) for item in result.get("history", []) if item.get("answer")]
    result["timing"] = timing_summary(timings)
    result["history"] = [public_question(item) for item in result.get("history", [])]
    return result


def timing_summary(timings: list[int]) -> dict:
    """Keep timing derived from the existing per-answer history field."""
    total = sum(timings)
    return {
        "total_sec": total,
        "average_sec": round(total / len(timings)) if timings else 0,
        "fastest_sec": min(timings, default=0),
        "slowest_sec": max(timings, default=0),
        "answered_count": len(timings),
    }


@router.post("/interview/start")
async def start(data: InterviewStartRequest, user: dict = Depends(current_user), settings: Settings = Depends(get_settings)):
    resume = await get_owned_resume(user["_id"]) if data.interview_type == "resume" else None
    domain = "resume" if resume else data.domain.lower()
    first_question = await next_question(domain, data.difficulty, data.role, [], settings, resume.get("structured") if resume else None)
    now = utc_now()
    first_entry = {"question": first_question.get("question", first_question.get("problem_statement", "")), "answer": "", "timeTakenSec": 0, **first_question}
    # Private test cases remain in the interview document and are never returned to the client.
    interview = {"_id": str(uuid.uuid4()), "userId": user["_id"], "domain": domain, "difficulty": data.difficulty, "role": data.role, "interviewType": data.interview_type, "questionLimit": data.question_count, "resume": {"filename": resume.get("filename"), "version": resume.get("version")} if resume else None, "history": [first_entry], "questions": [first_entry["question"]], "answers": [], "feedback": None, "analysis": None, "score": None, "status": "active", "createdAt": now, "finishedAt": None, "security": {"violationCount": 0, "events": [], "terminated": False, "terminationReason": None}}
    await database.get_db().interviews.insert_one(interview)
    return {"session_id": interview["_id"], "question": public_question(first_entry), "question_number": 1, "interview_type": data.interview_type}


@router.post("/interview/answer")
async def answer(data: AnswerRequest, user: dict = Depends(current_user), settings: Settings = Depends(get_settings)):
    interview = await get_owned_interview(data.session_id, user["_id"])
    if interview["status"] == "terminated":
        raise HTTPException(status_code=409, detail="Interview terminated due to security violation")
    if interview["status"] != "active":
        raise HTTPException(status_code=400, detail="This interview is already finished")
    history = interview["history"]
    if not history or history[-1].get("answer"):
        raise HTTPException(status_code=400, detail="Current question has already been answered")
    entry = history[-1]
    is_coding = entry.get("questionType") == "coding"
    if is_coding:
        if not data.code:
            raise HTTPException(status_code=422, detail="Submit your code for this coding challenge")
        entry.update({"answer": data.code, "timeTakenSec": data.time_taken_sec, "language": data.language or "python"})
        entry.setdefault("coding", {}).update({"difficulty": entry.get("difficulty"), "language": data.language or "python"})
    else:
        if not data.answer.strip():
            raise HTTPException(status_code=422, detail="Please provide an answer")
        entry.update({"answer": data.answer.strip(), "timeTakenSec": data.time_taken_sec})
        entry["mistakeAnalysis"] = await analyze_answer(entry.get("question", ""), entry["answer"], settings)
        entry["answerQuality"] = entry["mistakeAnalysis"].get("score", 55)
    if is_coding:
        coding_score = entry.get("coding", {}).get("score")
        entry["mistakeAnalysis"] = {"question": entry.get("question", ""), "status": "mostly_correct" if (coding_score or 0) >= 60 else "needs_improvement", "status_label": "Mostly Correct" if (coding_score or 0) >= 60 else "Needs Improvement", "score": coding_score if coding_score is not None else 50, "what_went_well": "Your solution was submitted for the available test cases.", "missing_information": "", "technical_mistake": "" if (coding_score or 0) >= 60 else "The submitted solution did not pass enough available test cases.", "how_to_improve": "Trace edge cases and complexity before submitting.", "correct_explanation": "A strong coding answer should be correct for the stated constraints and explain its complexity.", "better_answer": "Explain the approach, then provide a solution that satisfies all available cases.", "improvement_tip": "Validate boundary cases and state time and space complexity.", "mistakes": []}
        entry["answerQuality"] = entry["mistakeAnalysis"]["score"]
    count = len([item for item in history if item["answer"]])
    done = count >= interview.get("questionLimit", MAX_QUESTIONS)
    await database.get_db().interviews.update_one({"_id": interview["_id"]}, {"$set": {"history": history, "questions": [item["question"] for item in history], "answers": [item["answer"] for item in history if item["answer"]]}})
    return {"question_number": count, "done": done, "mistake_analysis": entry.get("mistakeAnalysis"), "coding": entry.get("coding")}


@router.post("/interview/next")
async def get_next_question(data: FinishRequest, user: dict = Depends(current_user), settings: Settings = Depends(get_settings)):
    """Prepare the next question while the candidate reads the professor review.

    If a retry happens, returning the already-persisted unanswered entry prevents duplicates.
    """
    interview = await get_owned_interview(data.session_id, user["_id"])
    if interview.get("status") != "active":
        raise HTTPException(status_code=400, detail="This interview is no longer active")
    history = interview.get("history", [])
    if history and not history[-1].get("answer"):
        return {"question": public_question(history[-1]), "question_number": len(history)}
    if len([entry for entry in history if entry.get("answer")]) >= interview.get("questionLimit", MAX_QUESTIONS):
        return {"question": None, "question_number": len(history), "done": True}
    resume = await get_owned_resume(user["_id"]) if interview.get("interviewType") == "resume" else None
    generated = await next_question(interview["domain"], interview["difficulty"], interview["role"], history, settings, resume.get("structured") if resume else None)
    question = {"question": generated.get("question", generated.get("problem_statement", "")), "answer": "", "timeTakenSec": 0, **generated}
    history.append(question)
    await database.get_db().interviews.update_one({"_id": interview["_id"], "userId": user["_id"]}, {"$set": {"history": history, "questions": [item["question"] for item in history]}})
    return {"question": public_question(question), "question_number": len(history), "done": False}


@router.post("/interview/finish")
async def finish(data: FinishRequest, user: dict = Depends(current_user), settings: Settings = Depends(get_settings)):
    interview = await get_owned_interview(data.session_id, user["_id"])
    if interview["status"] == "terminated":
        raise HTTPException(status_code=409, detail="Interview terminated due to security violation")
    if interview["status"] == "finished":
        return {"session_id": interview["_id"], "analysis": interview["analysis"]}
    history = [item for item in interview["history"] if item.get("answer")]
    if not history:
        raise HTTPException(status_code=400, detail="At least one answer is required to finish an interview")
    analysis = await evaluate(history, interview["domain"], interview["role"], settings)
    analysis["question_reviews"] = [item.get("mistakeAnalysis") for item in history if item.get("mistakeAnalysis")]
    now = utc_now()
    db = database.get_db()
    await db.interviews.update_one({"_id": interview["_id"]}, {"$set": {"status": "finished", "finishedAt": now, "analysis": analysis, "feedback": analysis, "score": analysis["overall_score"]}})
    await db.feedback.update_one({"interviewId": interview["_id"]}, {"$set": {"interviewId": interview["_id"], "userId": user["_id"], "feedback": analysis, "createdAt": now}}, upsert=True)
    return {"session_id": interview["_id"], "analysis": analysis}


@router.post("/interview/security-event")
async def security_event(data: SecurityEventRequest, user: dict = Depends(current_user)):
    """Persist a browser-observable security signal; the server owns the counter."""
    db = database.get_db()
    interview = await get_owned_interview(data.session_id, user["_id"])
    if interview["status"] == "terminated":
        security = interview.get("security", {})
        return {"violation_count": security.get("violationCount", 2), "warning": False, "terminated": True}
    if interview["status"] != "active":
        raise HTTPException(status_code=400, detail="This interview is no longer active")

    security = interview.get("security", {})
    if any(event.get("eventId") == data.event_id for event in security.get("events", [])):
        return {"violation_count": security.get("violationCount", 0), "warning": security.get("violationCount", 0) == 1, "terminated": False}

    now = utc_now()
    count = security.get("violationCount", 0) + 1
    terminated = count >= 2
    event = {"eventId": data.event_id, "type": data.event_type, "label": SECURITY_EVENT_LABELS[data.event_type], "questionNumber": data.question_number, "timestamp": now, "severity": "high"}
    updates = {"security.violationCount": count, "security.events": [*security.get("events", []), event], "security.terminated": terminated}
    if terminated:
        updates.update({"security.terminationReason": "SECURITY_VIOLATION", "status": "terminated", "finishedAt": now})
    await db.interviews.update_one({"_id": interview["_id"], "userId": user["_id"], "status": "active"}, {"$set": updates})
    logger.warning("Interview security violation: session=%s user=%s type=%s question=%s", interview["_id"], user["_id"], data.event_type, data.question_number)
    return {"violation_count": count, "warning": count == 1, "terminated": terminated}


@router.get("/interview/history")
async def history(user: dict = Depends(current_user)):
    rows = await database.get_db().interviews.find({"userId": user["_id"]}).sort("createdAt", -1).to_list(200)
    return {"items": [serialize(item) for item in rows]}


@router.get("/interviews")
async def list_interviews(user: dict = Depends(current_user)):
    return await history(user)


@router.get("/question-bank")
async def question_bank(
    domain: str | None = None,
    difficulty: str | None = None,
    role: str | None = None,
    interview: str | None = None,
    search: str | None = None,
    date: str | None = None,
    user: dict = Depends(current_user),
):
    """Project each completed, user-owned interview history entry as a saved question.

    This intentionally uses the interview document as the only source of questions,
    preventing duplicated data and preserving ownership through the JWT user.
    """
    filters: dict = {"userId": user["_id"], "status": "finished"}
    if domain:
        filters["domain"] = domain.lower()
    if difficulty:
        filters["difficulty"] = difficulty.lower()
    if role:
        filters["role"] = {"$regex": re.escape(role), "$options": "i"}
    if interview:
        filters["_id"] = interview
    rows = await database.get_db().interviews.find(filters).sort("createdAt", -1).to_list(500)
    date_value = None
    if date:
        try:
            date_value = datetime.fromisoformat(date).date().isoformat()
        except ValueError:
            raise HTTPException(status_code=422, detail="Date must use YYYY-MM-DD format")
    needle = (search or "").strip().lower()
    items = []
    for session in rows:
        asked_date = session["createdAt"].date().isoformat()
        if date_value and asked_date != date_value:
            continue
        for index, entry in enumerate(session.get("history", []), start=1):
            question = entry.get("question", "")
            if needle and needle not in question.lower():
                continue
            items.append({
                "id": f"{session['_id']}:{index}",
                "interview_id": session["_id"],
                "question_number": index,
                "question": question,
                "answer": entry.get("answer", ""),
                "question_type": entry.get("questionType", "technical"),
                "question_source": entry.get("questionSource", "standard"),
                "coding": entry.get("coding"),
                "mistake_analysis": entry.get("mistakeAnalysis"),
                "time_taken_sec": entry.get("timeTakenSec", 0),
                "domain": session.get("domain", ""),
                "difficulty": session.get("difficulty", ""),
                "role": session.get("role", ""),
                "date_asked": asked_date,
                "interview_type": session.get("interviewType", "standard"),
                "resume": session.get("resume"),
                "interview_title": "Resume-Based Interview" if session.get("interviewType") == "resume" else f"{session.get('domain', 'Interview').title()} Interview",
                "feedback": session.get("analysis"),
            })
    return {"items": items}


@router.get("/question-bank/{question_id}")
async def question_bank_detail(question_id: str, user: dict = Depends(current_user)):
    try:
        interview_id, raw_index = question_id.rsplit(":", 1)
        index = int(raw_index)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Question not found") from exc
    session = await get_owned_interview(interview_id, user["_id"])
    if session.get("status") != "finished" or index < 1 or index > len(session.get("history", [])):
        raise HTTPException(status_code=404, detail="Question not found")
    entry = session["history"][index - 1]
    return {
        "id": question_id, "interview_id": interview_id, "question_number": index,
        "question": entry.get("question", ""), "answer": entry.get("answer", ""), "question_type": entry.get("questionType", "technical"), "question_source": entry.get("questionSource", "standard"), "coding": entry.get("coding"), "mistake_analysis": entry.get("mistakeAnalysis"), "interview_type": session.get("interviewType", "standard"), "resume": session.get("resume"),
        "time_taken_sec": entry.get("timeTakenSec", 0), "domain": session.get("domain", ""),
        "difficulty": session.get("difficulty", ""), "role": session.get("role", ""),
        "date_asked": session["createdAt"].date().isoformat(),
        "interview_title": "Resume-Based Interview" if session.get("interviewType") == "resume" else f"{session.get('domain', 'Interview').title()} Interview",
        "feedback": session.get("analysis"),
    }


@router.get("/interview/{session_id}")
async def get_interview(session_id: str, user: dict = Depends(current_user)):
    return serialize(await get_owned_interview(session_id, user["_id"]))
