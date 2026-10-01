import asyncio
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies.auth import current_user
from app.database.mongo import database
from app.schemas.api import CodeRunRequest

router = APIRouter(tags=["Code execution"])
TIMEOUT_SECONDS = 5


async def run_process(command: list[str], cwd: str, stdin: str = "") -> tuple[str, str, int]:
    """Run untrusted code without relying on the active asyncio event loop.

    On Windows, a SelectorEventLoop cannot create subprocess transports and
    raises ``NotImplementedError`` for ``asyncio.create_subprocess_exec``.
    Running the blocking call in a worker thread works with either Windows
    event-loop policy while keeping the FastAPI request handler asynchronous.
    """
    def execute() -> tuple[str, str, int]:
        try:
            result = subprocess.run(
                command,
                cwd=cwd,
                input=stdin.encode(),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=TIMEOUT_SECONDS,
                check=False,
            )
            return (
                result.stdout.decode(errors="replace")[:10000],
                result.stderr.decode(errors="replace")[:10000],
                result.returncode,
            )
        except subprocess.TimeoutExpired:
            return "", f"Execution exceeded the {TIMEOUT_SECONDS}-second limit.", 124

    return await asyncio.to_thread(execute)


@router.post("/code/run")
async def run_code(data: CodeRunRequest, user: dict = Depends(current_user)):
    """Execute code with a strict wall-clock limit; deploy behind an OS/container sandbox in production."""
    with tempfile.TemporaryDirectory(prefix="mockmind-code-") as temp_dir:
        workdir = Path(temp_dir)
        if data.language == "python":
            source = workdir / "main.py"
            source.write_text(data.code, encoding="utf-8")
            stdout, stderr, exit_code = await run_process([os.sys.executable, "-I", str(source)], temp_dir)
        elif data.language == "cpp":
            compiler = shutil.which("g++")
            if not compiler:
                raise HTTPException(status_code=503, detail="C++ compiler is not installed on this server")
            source, binary = workdir / "main.cpp", workdir / "main.exe"
            source.write_text(data.code, encoding="utf-8")
            stdout, stderr, exit_code = await run_process([compiler, str(source), "-O2", "-o", str(binary)], temp_dir)
            if exit_code == 0:
                stdout, stderr, exit_code = await run_process([str(binary)], temp_dir)
        else:
            compiler = shutil.which("javac")
            runtime = shutil.which("java")
            if not compiler or not runtime:
                raise HTTPException(status_code=503, detail="Java runtime is not installed on this server")
            source = workdir / "Main.java"
            source.write_text(data.code, encoding="utf-8")
            stdout, stderr, exit_code = await run_process([compiler, str(source)], temp_dir)
            if exit_code == 0:
                stdout, stderr, exit_code = await run_process([runtime, "-cp", temp_dir, "Main"], temp_dir)
    # The visible ad-hoc run has no input. Do not report that empty-input result for a challenge.
    if data.session_id:
        stdout, stderr, exit_code = "", "", 0
    # A coding challenge is evaluated only against server-held cases, never client input.
    if not data.session_id:
        return {"stdout": stdout, "stderr": stderr, "exit_code": exit_code}
    interview = await database.get_db().interviews.find_one({"_id": data.session_id, "userId": user["_id"], "status": "active"})
    if not interview or not interview.get("history") or interview["history"][-1].get("questionType") != "coding":
        raise HTTPException(status_code=404, detail="Active coding challenge not found")
    entry = interview["history"][-1]
    cases = entry.get("test_cases", [])
    # Re-run through the same restricted executor with each private input.
    results = []
    with tempfile.TemporaryDirectory(prefix="mockmind-code-tests-") as temp_dir:
        workdir = Path(temp_dir)
        if data.language == "python":
            source = workdir / "main.py"; source.write_text(data.code, encoding="utf-8")
            command = [os.sys.executable, "-I", str(source)]
        elif data.language == "cpp":
            compiler = shutil.which("g++")
            if not compiler: raise HTTPException(status_code=503, detail="C++ compiler is not installed on this server")
            source, binary = workdir / "main.cpp", workdir / "main.exe"; source.write_text(data.code, encoding="utf-8")
            _, compile_err, compile_code = await run_process([compiler, str(source), "-O2", "-o", str(binary)], temp_dir)
            if compile_code: return {"stdout": "", "stderr": compile_err, "exit_code": compile_code, "passed": 0, "total": len(cases), "score": 0}
            command = [str(binary)]
        else:
            compiler, runtime = shutil.which("javac"), shutil.which("java")
            if not compiler or not runtime: raise HTTPException(status_code=503, detail="Java runtime is not installed on this server")
            source = workdir / "Main.java"; source.write_text(data.code, encoding="utf-8")
            _, compile_err, compile_code = await run_process([compiler, str(source)], temp_dir)
            if compile_code: return {"stdout": "", "stderr": compile_err, "exit_code": compile_code, "passed": 0, "total": len(cases), "score": 0}
            command = [runtime, "-cp", temp_dir, "Main"]
        for case in cases:
            actual, err, code = await run_process(command, temp_dir, case["input"])
            passed = code == 0 and actual.strip() == case["output"].strip()
            results.append(passed)
    passed = sum(results); total = len(cases); score = round((passed / total) * 100) if total else 0
    entry["coding"] = {"difficulty": entry.get("difficulty"), "language": data.language, "passed": passed, "total": total, "score": score}
    await database.get_db().interviews.update_one({"_id": interview["_id"]}, {"$set": {"history": interview["history"]}})
    return {"stdout": stdout, "stderr": stderr, "exit_code": exit_code, "passed": passed, "total": total, "score": score}
