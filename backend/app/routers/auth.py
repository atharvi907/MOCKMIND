import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pymongo.errors import DuplicateKeyError

from app.config.settings import Settings, get_settings
from app.database.mongo import database
from app.dependencies.auth import current_user, security
from app.schemas.api import LoginRequest, ProfileUpdateRequest, RegisterRequest
from app.services.users import public_user
from app.utils.security import create_token, decode_token, hash_password, utc_now, verify_password

router = APIRouter(tags=["Authentication"])
logger = logging.getLogger(__name__)


async def issue_session(user: dict, settings: Settings) -> dict:
    token, jti, expires_at = create_token(user["_id"], settings)
    await database.get_db().sessions.insert_one({"_id": str(uuid.uuid4()), "jti": jti, "userId": user["_id"], "expiresAt": expires_at, "createdAt": utc_now()})
    logger.info("Created authenticated session for user_id=%s", user["_id"])
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, settings: Settings = Depends(get_settings)):
    logger.info("Register attempt for email=%s", str(data.email).lower())
    now = utc_now()
    user = {"_id": str(uuid.uuid4()), "fullName": data.full_name, "email": str(data.email).lower(), "phone": data.phone, "password": hash_password(data.password), "college": data.college, "branch": data.branch, "year": data.year, "skills": data.skills, "role": "student", "profileImage": "", "resume": "", "linkedin": "", "github": "", "createdAt": now, "updatedAt": now, "lastLogin": now, "isVerified": False, "isActive": True}
    try:
        await database.get_db().users.insert_one(user)
    except DuplicateKeyError as exc:
        logger.warning("Registration rejected because email already exists: %s", user["email"])
        raise HTTPException(status_code=409, detail="An account with this email already exists") from exc
    logger.info("Created user document user_id=%s", user["_id"])
    return await issue_session(user, settings)


@router.post("/login")
async def login(data: LoginRequest, settings: Settings = Depends(get_settings)):
    logger.info("Login attempt for email=%s", str(data.email).lower())
    db = database.get_db()
    user = await db.users.find_one({"email": str(data.email).lower()})
    if not user or not verify_password(data.password, user["password"]):
        logger.warning("Login rejected for email=%s", str(data.email).lower())
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("isActive", True):
        logger.warning("Login rejected for inactive user_id=%s", user["_id"])
        raise HTTPException(status_code=403, detail="User account is inactive")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLogin": utc_now()}})
    user["lastLogin"] = utc_now()
    logger.info("Login succeeded for user_id=%s", user["_id"])
    return await issue_session(user, settings)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(credentials=Depends(security), _: dict = Depends(current_user), settings: Settings = Depends(get_settings)):
    payload = decode_token(credentials.credentials, settings)
    await database.get_db().sessions.delete_one({"jti": payload["jti"]})
    logger.info("Logged out user_id=%s", payload["sub"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/profile")
async def get_profile(user: dict = Depends(current_user)):
    return {"user": public_user(user)}


@router.put("/profile")
async def update_profile(data: ProfileUpdateRequest, user: dict = Depends(current_user)):
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    mapping = {"full_name": "fullName"}
    changes = {mapping.get(key, key): value for key, value in changes.items()}
    changes["updatedAt"] = utc_now()
    await database.get_db().users.update_one({"_id": user["_id"]}, {"$set": changes})
    updated = await database.get_db().users.find_one({"_id": user["_id"]})
    return {"user": public_user(updated)}
