import uuid
import re
import logging
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
try:
    from pypdf import PdfReader
except ImportError:  # Allows unrelated API routes to keep running until dependencies are installed.
    PdfReader = None
try:
    import fitz  # PyMuPDF; fallback for PDFs pypdf cannot decode reliably.
except ImportError:
    fitz = None

from app.config.settings import Settings, get_settings
from app.database.mongo import database
from app.dependencies.auth import current_user
from app.utils.security import utc_now

router = APIRouter(tags=["Profile"])
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
RESUME_TYPES = {"application/pdf"}
logger = logging.getLogger(__name__)


def compact(values: list[str], limit: int = 24) -> list[str]:
    return list(dict.fromkeys(value.strip(" -•\t") for value in values if value and value.strip(" -•\t")))[:limit]


def structure_resume(text: str) -> dict:
    """Make a minimal, auditable profile without inventing facts from the PDF."""
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    lowered = "\n".join(lines)
    skill_line = re.search(r"(?:technical )?skills?\s*[:\-]?\s*([^\n]{3,700})", lowered, re.I)
    raw_skills = re.split(r"[,|•;/]", skill_line.group(1)) if skill_line else []
    known_terms = re.findall(r"\b(?:Python|JavaScript|TypeScript|Java|C\+\+|C#|React(?:\.js)?|Next\.js|Node(?:\.js)?|FastAPI|Django|Flask|MongoDB|MySQL|PostgreSQL|SQL|Docker|Kubernetes|AWS|Azure|Git|Gemini(?: API)?|TensorFlow|PyTorch)\b", lowered, re.I)
    sections = {"projects": [], "experience": [], "education": [], "certifications": [], "achievements": []}
    current = None
    markers = {
        "project": "projects", "experience": "experience", "employment": "experience", "internship": "experience",
        "education": "education", "certification": "certifications", "achievement": "achievements",
    }
    for line in lines:
        marker = next((value for key, value in markers.items() if re.fullmatch(rf"{key}s?", line, re.I)), None)
        if marker:
            current = marker
        elif current and len(line) > 3 and not re.match(r"^(skills?|contact|summary|objective)\b", line, re.I):
            sections[current].append(line)
    projects = []
    for value in compact(sections["projects"], 8):
        technologies = compact(re.findall(r"\b(?:React(?:\.js)?|FastAPI|MongoDB|Node(?:\.js)?|Python|JavaScript|TypeScript|Docker|AWS|SQL|Gemini(?: API)?)\b", value, re.I), 8)
        projects.append({"name": value[:160], "technologies": technologies})
    first_name = lines[0][:120] if lines and "@" not in lines[0] and len(lines[0].split()) <= 6 else ""
    return {
        "name": first_name,
        "skills": compact([*raw_skills, *known_terms]),
        "projects": projects,
        "experience": compact(sections["experience"], 8),
        "education": compact(sections["education"], 6),
        "certifications": compact(sections["certifications"], 6),
        "achievements": compact(sections["achievements"], 6),
    }


def extract_with_pypdf(content: bytes) -> str:
    if PdfReader is None:
        return ""
    reader = PdfReader(BytesIO(content))
    return "\n".join(page.extract_text() or "" for page in reader.pages).strip()


def extract_with_pymupdf(content: bytes) -> str:
    if fitz is None:
        return ""
    document = fitz.open(stream=content, filetype="pdf")
    try:
        return "\n".join(page.get_text("text") for page in document).strip()
    finally:
        document.close()


def extract_pdf_resume(content: bytes) -> tuple[str, dict]:
    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=415, detail="The uploaded file is not a valid PDF")
    if PdfReader is None and fitz is None:
        raise HTTPException(status_code=503, detail="Resume processing is temporarily unavailable. Install server dependencies and try again.")
    text = ""
    try:
        text = extract_with_pypdf(content)
    except Exception as exc:
        # Do not log resume content, only the parser outcome.
        logger.warning("pypdf could not extract uploaded resume text: %s", type(exc).__name__)
    if len(text) < 40:
        try:
            text = extract_with_pymupdf(content)
        except Exception as exc:
            logger.warning("PyMuPDF could not extract uploaded resume text: %s", type(exc).__name__)
    if len(text) < 40:
        raise HTTPException(status_code=422, detail="No selectable text could be extracted from this PDF. Upload a text-based PDF or run OCR first.")
    return text[:100_000], structure_resume(text)


async def persist_upload(file: UploadFile, allowed_types: set[str], kind: str, user: dict, settings: Settings) -> dict:
    # Some browsers report a valid PDF as application/octet-stream. The extension
    # and PDF signature checks below still protect the resume upload path.
    if file.content_type not in allowed_types and not (kind == "resume" and file.content_type == "application/octet-stream"):
        raise HTTPException(status_code=415, detail=f"Unsupported {kind} file type")
    content = await file.read(settings.max_upload_bytes + 1)
    if not content or len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File is empty or exceeds the upload limit")
    if kind == "resume" and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Please upload a PDF resume")
    extracted_text, structured = extract_pdf_resume(content) if kind == "resume" else (None, None)
    # MongoDB keeps `_id` immutable. Generate it only when this is the user's
    # first upload; a replacement upload must retain the existing document id.
    record = {"userId": user["_id"], "kind": kind, "filename": file.filename or kind, "contentType": file.content_type, "size": len(content), "content": content, "updatedAt": utc_now()}
    if kind == "resume":
        record.update({"extractedText": extracted_text, "structured": structured, "version": str(uuid.uuid4())})
    db = database.get_db()
    collection = db.resumes if kind == "resume" else db.profile_images
    await collection.update_one(
        {"userId": user["_id"]},
        {"$set": record, "$setOnInsert": {"_id": str(uuid.uuid4())}},
        upsert=True,
    )
    result = {"filename": record["filename"], "contentType": record["contentType"], "size": record["size"]}
    if kind == "resume":
        result.update({"version": record["version"], "ready": True, "summary": {"skill_count": len(structured["skills"]), "project_count": len(structured["projects"]), "experience_count": len(structured["experience"])}})
    return result


@router.post("/profile/upload-image")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(current_user), settings: Settings = Depends(get_settings)):
    metadata = await persist_upload(file, IMAGE_TYPES, "profileImage", user, settings)
    await database.get_db().users.update_one({"_id": user["_id"]}, {"$set": {"profileImage": metadata, "updatedAt": utc_now()}})
    return {"profileImage": metadata}


@router.post("/profile/upload-resume")
async def upload_resume(file: UploadFile = File(...), user: dict = Depends(current_user), settings: Settings = Depends(get_settings)):
    metadata = await persist_upload(file, RESUME_TYPES, "resume", user, settings)
    await database.get_db().users.update_one({"_id": user["_id"]}, {"$set": {"resume": metadata, "updatedAt": utc_now()}})
    return {"resume": metadata}


@router.get("/profile/resume")
async def resume_status(user: dict = Depends(current_user)):
    resume = await database.get_db().resumes.find_one({"userId": user["_id"]}, {"content": 0, "extractedText": 0})
    if not resume:
        return {"resume": None}
    structured = resume.get("structured", {})
    return {"resume": {"filename": resume.get("filename"), "size": resume.get("size"), "version": resume.get("version"), "ready": bool(resume.get("extractedText")), "summary": {"skill_count": len(structured.get("skills", [])), "project_count": len(structured.get("projects", [])), "experience_count": len(structured.get("experience", []))}}}
