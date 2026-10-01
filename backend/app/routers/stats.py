from fastapi import APIRouter, Depends

from app.database.mongo import database
from app.dependencies.auth import current_user
from app.utils.security import utc_now

router = APIRouter(tags=["Statistics"])


@router.get("/stats")
async def stats(user: dict = Depends(current_user)):
    db = database.get_db()
    interviews = await db.interviews.find({"userId": user["_id"], "status": "finished"}).sort("createdAt", 1).to_list(500)
    scores = [item.get("score", 0) for item in interviews]
    answer_times = [entry.get("timeTakenSec", 0) for item in interviews for entry in item.get("history", []) if entry.get("answer")]
    domain_scores: dict[str, list[int]] = {}
    for item in interviews:
        domain_scores.setdefault(item["domain"], []).append(item.get("score", 0))
    by_domain = {domain: round(sum(values) / len(values), 1) for domain, values in domain_scores.items()}
    average = round(sum(scores) / len(scores), 1) if scores else 0
    strong = sorted(by_domain, key=by_domain.get, reverse=True)[:3]
    weak = sorted(by_domain, key=by_domain.get)[:3]
    result = {"total_interviews": len(interviews), "interview_count": len(interviews), "average_score": average, "highest_score": max(scores, default=0), "question_count": len(answer_times), "average_answer_time_sec": round(sum(answer_times) / len(answer_times)) if answer_times else 0, "by_domain": by_domain, "strong_topics": strong, "weak_topics": weak, "recent_interviews": [{"id": item["_id"], "domain": item["domain"], "score": item.get("score", 0), "createdAt": item["createdAt"].isoformat()} for item in interviews[-5:][::-1]], "timeline": [{"date": item["createdAt"].date().isoformat(), "score": item.get("score", 0), "domain": item["domain"]} for item in interviews]}
    await db.statistics.update_one({"userId": user["_id"]}, {"$set": {"userId": user["_id"], **result, "updatedAt": utc_now()}}, upsert=True)
    return result
