"""
MockMind FastAPI Entrypoint.
Delegates to backend.app.main for canonical application instance and configuration.
"""
from pathlib import Path
import sys
import uvicorn

BACKEND_DIR = Path(__file__).parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app

if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8001, reload=True)
