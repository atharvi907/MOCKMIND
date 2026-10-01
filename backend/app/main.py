import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config.settings import get_settings
from app.database.mongo import database
from app.routers import auth, code, interviews, profile_uploads, stats

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await database.connect(settings)
    yield
    database.close()


app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["GET", "POST", "PUT", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])


@app.middleware("http")
async def log_api_requests(request: Request, call_next):
    """Log request outcomes without recording passwords or authorization tokens."""
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled request error: %s %s", request.method, request.url.path)
        raise
    logger.info("Request completed: %s %s -> %s", request.method, request.url.path, response.status_code)
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.get("/health", tags=["Health"])
async def health():
    await database.get_db().command("ping")
    return {"status": "ok"}


api_prefix = "/api"
for router in (auth.router, profile_uploads.router, interviews.router, stats.router, code.router):
    app.include_router(router, prefix=api_prefix)
