import json
import re
import httpx

from app.config.settings import Settings

FALLBACK_QUESTIONS = {
    "dsa": ["Explain the trade-off between a hash map and sorting when looking for pairs in an array.", "When would a sliding-window solution be preferable to nested loops?", "How would you reason about the edge cases of a binary search implementation?"],
    "projects": ["Describe a project you built and the most important technical decision you made.", "How did you design the architecture and choose between trade-offs?", "What difficult production issue did you diagnose?"],
    "behavioral": ["Tell me about a time you solved a difficult problem with limited information.", "What was your responsibility and how did you prioritize?", "How did you handle disagreement or feedback?"],
}

FALLBACK_CODING = {
    "easy": {"title": "Two Sum", "problem_statement": "Given an array of integers and a target, return the indices of two numbers whose values add up to the target. Return any valid pair.", "input_format": "Line 1: space-separated integers\nLine 2: target integer", "output_format": "Two zero-based indices separated by a space", "constraints": "2 <= n <= 10^4", "examples": [{"input": "2 7 11 15\n9", "output": "0 1"}], "test_cases": [{"input": "2 7 11 15\n9\n", "output": "0 1"}, {"input": "3 2 4\n6\n", "output": "1 2"}]},
    "medium": {"title": "Longest Unique Substring", "problem_statement": "Given a string, print the length of its longest substring without repeating characters.", "input_format": "One string", "output_format": "One integer", "constraints": "1 <= length <= 10^4", "examples": [{"input": "abcabcbb", "output": "3"}], "test_cases": [{"input": "abcabcbb\n", "output": "3"}, {"input": "bbbbb\n", "output": "1"}, {"input": "pwwkew\n", "output": "3"}]},
    "hard": {"title": "Minimum Window Substring", "problem_statement": "Given strings s and t, print the shortest substring of s containing every character of t. Print an empty line if none exists.", "input_format": "Line 1: s\nLine 2: t", "output_format": "The minimum window", "constraints": "1 <= length <= 10^4", "examples": [{"input": "ADOBECODEBANC\nABC", "output": "BANC"}], "test_cases": [{"input": "ADOBECODEBANC\nABC\n", "output": "BANC"}, {"input": "a\na\n", "output": "a"}]},
}

def fallback_question(domain: str, index: int) -> str:
    questions = FALLBACK_QUESTIONS.get(domain.lower(), FALLBACK_QUESTIONS["behavioral"])
    return questions[min(index, len(questions) - 1)]

async def gemini_text(prompt: str, settings: Settings) -> str | None:
    if not settings.gemini_api_key:
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.25, "maxOutputTokens": 1800}}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, params={"key": settings.gemini_api_key}, json=body)
        response.raise_for_status()
    return response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()

def technical_domain(domain: str) -> bool:
    return domain.lower() in {"dsa", "projects"}

def adaptive_difficulty(previous: list[dict], selected: str) -> str:
    scores = []
    for item in previous:
        if item.get("coding", {}).get("score") is not None:
            scores.append(item["coding"]["score"])
        elif item.get("answerQuality") is not None:
            scores.append(item["answerQuality"])
    if not scores:
        return selected
    average = sum(scores[-3:]) / min(3, len(scores))
    if average < 55:
        return "easy"
    if average >= 82:
        return "hard" if selected == "hard" or len(scores) >= 3 else "medium"
    return "medium"

def should_ask_coding(domain: str, previous: list[dict]) -> bool:
    if not technical_domain(domain):
        return False
    answered = [x for x in previous if x.get("answer")]
    coding_count = sum(1 for x in answered if x.get("questionType") == "coding")
    return len(answered) >= 2 and coding_count < 2 and (len(answered) - coding_count) >= 2

def coding_question(difficulty: str) -> dict:
    item = dict(FALLBACK_CODING[difficulty])
    item["questionType"] = "coding"
    item["difficulty"] = difficulty
    return item

def resume_fallback_question(resume: dict, previous: list[dict]) -> str:
    """Ask only about terms the parser found; never manufacture a resume detail."""
    asked = " ".join(item.get("question", "").lower() for item in previous)
    projects = resume.get("projects", [])
    skills = resume.get("skills", [])
    for project in projects:
        name = project.get("name", "")
        technologies = project.get("technologies", [])
        if name and name.lower() not in asked:
            tech = ", ".join(technologies[:3])
            return f"Please walk me through {name}{f' and the role of {tech}' if tech else ''}. What was your contribution and the key technical decision?"
    for skill in skills:
        if skill.lower() not in asked:
            return f"You list {skill} on your resume. Where have you applied it, and what trade-off did you make?"
    for section, prompt in (("experience", "Please describe the responsibilities and a challenge from this experience listed on your resume."), ("education", "How has the education listed on your resume prepared you for this role?"), ("certifications", "What practical capability did you gain from this certification listed on your resume?")):
        if resume.get(section):
            return prompt
    return "Please summarize one item explicitly listed on your resume and explain why it is relevant to this role."


async def next_question(domain: str, difficulty: str, role: str, previous: list[dict], settings: Settings, resume: dict | None = None) -> dict:
    if resume:
        facts = json.dumps({"skills": resume.get("skills", []), "projects": resume.get("projects", []), "experience": resume.get("experience", []), "education": resume.get("education", []), "certifications": resume.get("certifications", [])})
        prompt = f'''You are a careful technical interviewer for a {role}. Ask exactly one concise interview question using ONLY the candidate facts in RESUME_FACTS. Do not infer or mention any technology, employer, accomplishment, or project absent from those facts. Prioritize projects and technical skills. Avoid repeating PREVIOUS_QUESTIONS. Return only the question.\nRESUME_FACTS: {facts}\nPREVIOUS_QUESTIONS: {[x.get("question", "") for x in previous]}'''
        try:
            result = await gemini_text(prompt, settings)
            if result:
                return {"question": result, "questionType": "technical", "questionSource": "resume"}
        except (httpx.HTTPError, KeyError, IndexError):
            pass
        return {"question": resume_fallback_question(resume, previous), "questionType": "technical", "questionSource": "resume"}
    if should_ask_coding(domain, previous):
        return coding_question(adaptive_difficulty(previous, difficulty))
    prompt = f"You are conducting a {difficulty} {domain} interview for a {role}. Ask exactly one concise non-coding interview question. Avoid repeating: {[x.get('question', '') for x in previous]}. Return only the question."
    try:
        result = await gemini_text(prompt, settings)
        if result:
            return {"question": result, "questionType": "technical"}
    except (httpx.HTTPError, KeyError, IndexError):
        pass
    return {"question": fallback_question(domain, len(previous)), "questionType": "technical"}

STATUS_LABELS = {
    "correct": "Correct", "mostly_correct": "Mostly Correct", "partially_correct": "Partially Correct",
    "needs_improvement": "Needs Improvement", "incorrect": "Incorrect", "missing_information": "Missing Information",
}


def fallback_mistake(question: str, answer: str) -> dict:
    if len(answer.strip().split()) < 4:
        return {"status": "missing_information", "status_label": "Missing Information", "question": question, "score": 25, "what_went_well": "", "missing_information": "The response is too brief to demonstrate the reasoning behind your answer.", "technical_mistake": "", "how_to_improve": "State the definition, explain why it matters, and add one concise example.", "correct_explanation": "A complete answer should directly address the question with accurate reasoning.", "better_answer": "Start with the core definition, then support it with an example from the question's context.", "improvement_tip": "Use definition → reasoning → example.", "mistakes": []}
    return {"status": "needs_improvement", "status_label": "Needs Improvement", "question": question, "score": 55, "what_went_well": "Your response was recorded and addressed the prompt.", "missing_information": "Detailed model review is temporarily unavailable.", "technical_mistake": "", "how_to_improve": "Make your reasoning explicit and include a concrete, relevant example.", "correct_explanation": "Review the expected concepts for this question before your next attempt.", "better_answer": "Give a direct answer, then explain the key trade-offs or implementation details.", "improvement_tip": "Structure each response in two or three focused points.", "mistakes": []}


def normalize_review(parsed: dict, question: str) -> dict:
    status = str(parsed.get("status", "needs_improvement")).lower().replace(" ", "_")
    aliases = {"no_major_mistake": "correct", "unavailable": "needs_improvement", "mostly_correct": "mostly_correct"}
    status = aliases.get(status, status)
    if status not in STATUS_LABELS:
        status = "needs_improvement"
    score = parsed.get("score")
    if not isinstance(score, (int, float)):
        score = {"correct": 90, "mostly_correct": 78, "partially_correct": 65, "needs_improvement": 45, "incorrect": 25, "missing_information": 25}[status]
    mistakes = parsed.get("mistakes") if isinstance(parsed.get("mistakes"), list) else []
    technical_mistake = parsed.get("technical_mistake") or next((item.get("what_went_wrong", "") for item in mistakes if isinstance(item, dict)), "")
    return {
        "question": question, "status": status, "status_label": STATUS_LABELS[status], "score": max(0, min(100, round(score))),
        "what_went_well": str(parsed.get("what_went_well", "")),
        "missing_information": str(parsed.get("missing_information", parsed.get("what_is_missing", ""))),
        "technical_mistake": str(technical_mistake),
        "how_to_improve": str(parsed.get("how_to_improve", parsed.get("small_improvement", ""))),
        "correct_explanation": str(parsed.get("correct_explanation", "")),
        "better_answer": str(parsed.get("better_answer", "")),
        "improvement_tip": str(parsed.get("improvement_tip", "")),
        "mistakes": mistakes,
    }

async def analyze_answer(question: str, answer: str, settings: Settings) -> dict:
    prompt = f'''Act as an experienced professor reviewing an interview answer. Compare the QUESTION and ANSWER on meaning, not exact wording: technically equivalent answers are valid. Do not invent errors. Return JSON only with status (correct|mostly_correct|partially_correct|needs_improvement|incorrect|missing_information), score (0-100), what_went_well, missing_information, technical_mistake, how_to_improve, correct_explanation, better_answer, improvement_tip, mistakes (array). Keep every field concise and factual.\nQUESTION: {question}\nANSWER: {answer}'''
    try:
        raw = await gemini_text(prompt, settings)
        parsed = json.loads(raw.removeprefix("```json").removesuffix("```").strip()) if raw else None
        if isinstance(parsed, dict) and parsed.get("status"):
            return normalize_review(parsed, question)
    except (httpx.HTTPError, ValueError, KeyError, IndexError):
        pass
    return fallback_mistake(question, answer)

def local_feedback(history: list[dict]) -> dict:
    text = " ".join(item.get("answer", "") for item in history)
    words = re.findall(r"\b\w+\b", text)
    fillers = sum(len(re.findall(rf"\b{word}\b", text, flags=re.I)) for word in ("um", "uh", "like", "basically", "actually"))
    answer_count = len(history)
    coding = [x.get("coding", {}) for x in history if x.get("questionType") == "coding" and x.get("coding", {}).get("score") is not None]
    depth = min(95, round(30 + min(len(words), 280) * .22 + answer_count * 7))
    clarity = max(30, min(95, round(70 + answer_count * 5 - fillers * 3)))
    confidence = min(95, round(40 + answer_count * 8 + min(len(words), 150) * .12))
    communication = round((clarity + confidence) / 2)
    score = round((depth + clarity + confidence + communication) / 4)
    coding_summary = {"question_count": len(coding), "overall_score": round(sum(x["score"] for x in coding) / len(coding)) if coding else None, "questions": coding}
    reviews = [x.get("mistakeAnalysis") for x in history if x.get("mistakeAnalysis")]
    return {"overall_score": score, "confidence": confidence, "clarity": clarity, "technical_depth": depth, "communication": communication, "filler_words": fillers, "strengths": ["Responses were structured", "You stayed engaged through the interview", "You provided relevant detail"], "weaknesses": ["Add more concrete evidence and metrics", "State trade-offs explicitly", "Cover edge cases before concluding"], "suggestions": ["Use a concise answer framework", "Lead with assumptions", "Finish with measurable impact"], "timing_insight": "Answer times are context for quality, not a score by themselves.", "summary": f"You completed {answer_count} responses.", "mistake_analysis": reviews, "question_reviews": reviews, "coding_performance": coding_summary}

async def evaluate(history: list[dict], domain: str, role: str, settings: Settings) -> dict:
    prompt = f"Evaluate this {domain} interview for a {role}. Return JSON only with keys overall_score, confidence, clarity, technical_depth, communication, filler_words, strengths, weaknesses, suggestions, summary, timing_insight. Scores are 0-100. Transcript: {json.dumps(history)}"
    result = local_feedback(history)
    try:
        raw = await gemini_text(prompt, settings)
        parsed = json.loads(raw.removeprefix("```json").removesuffix("```").strip()) if raw else None
        required = {"overall_score", "confidence", "clarity", "technical_depth", "communication", "filler_words", "strengths", "weaknesses", "suggestions", "summary"}
        if isinstance(parsed, dict) and required.issubset(parsed):
            result.update(parsed)
    except (httpx.HTTPError, ValueError, KeyError, IndexError):
        pass
    return result
