"""
Comprehensive Automated Integration Test for MockMind FastAPI Backend.
Uses TestClient with context manager to trigger ASGI lifespan events (Database connection).
"""
import sys
import uuid
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app

def run_tests():
    print("=== Starting MockMind API Integration Test Suite ===")
    with TestClient(app) as client:
        # 1. Health check
        res = client.get("/health")
        print(f"[1/9] Health Check: Status {res.status_code} -> {res.json()}")
        assert res.status_code == 200, "Health check failed"

        # 2. Registration
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        test_password = "Password123!"
        reg_payload = {
            "full_name": "Test Engineer",
            "email": test_email,
            "password": test_password,
        }
        res = client.post("/api/register", json=reg_payload)
        print(f"[2/9] User Registration: Status {res.status_code}")
        assert res.status_code == 201, f"Registration failed: {res.text}"
        auth_data = res.json()
        token = auth_data["access_token"]
        assert token, "Token missing from registration response"

        # 2b. Duplicate registration
        res_dup = client.post("/api/register", json=reg_payload)
        print(f"[2b/9] Duplicate Registration Rejection: Status {res_dup.status_code} -> {res_dup.json().get('detail')}")
        assert res_dup.status_code == 409, "Duplicate registration should return 409 Conflict"

        # 3. Login
        login_payload = {"email": test_email, "password": test_password}
        res = client.post("/api/login", json=login_payload)
        print(f"[3/9] User Login: Status {res.status_code}")
        assert res.status_code == 200, f"Login failed: {res.text}"

        # 3b. Wrong password
        res_wrong = client.post("/api/login", json={"email": test_email, "password": "WrongPassword!"})
        print(f"[3b/9] Wrong Password Rejection: Status {res_wrong.status_code} -> {res_wrong.json().get('detail')}")
        assert res_wrong.status_code == 401, "Wrong password should return 401 Unauthorized"

        # 4. Authenticated Profile
        headers = {"Authorization": f"Bearer {token}"}
        res = client.get("/api/profile", headers=headers)
        print(f"[4/9] Profile Lookup: Status {res.status_code} -> Name: {res.json().get('user', {}).get('name')}")
        assert res.status_code == 200, "Profile lookup failed"

        # 5. Start Interview
        start_payload = {"domain": "dsa", "difficulty": "medium", "role": "Full Stack Engineer"}
        res = client.post("/api/interview/start", json=start_payload, headers=headers)
        print(f"[5/9] Start Interview: Status {res.status_code}")
        assert res.status_code == 200, "Start interview failed"
        session_id = res.json()["session_id"]

        # 6. Submit Answer
        answer_payload = {
            "session_id": session_id,
            "answer": "To find the longest consecutive sequence in O(n) time, we insert all elements into a hash set for O(1) lookups.",
            "time_taken_sec": 45
        }
        res = client.post("/api/interview/answer", json=answer_payload, headers=headers)
        print(f"[6/9] Submit Answer: Status {res.status_code}")
        assert res.status_code == 200, "Submit answer failed"

        # 7. Finish Interview
        finish_payload = {"session_id": session_id}
        res = client.post("/api/interview/finish", json=finish_payload, headers=headers)
        print(f"[7/9] Finish Interview: Status {res.status_code} -> Score: {res.json().get('analysis', {}).get('overall_score')}")
        assert res.status_code == 200, "Finish interview failed"

        # 8. User Stats
        res = client.get("/api/stats", headers=headers)
        print(f"[8/9] User Stats: Status {res.status_code} -> Total: {res.json().get('total_interviews')}")
        assert res.status_code == 200, "User stats failed"

        # 9. Code Run Simulation
        code_payload = {"language": "python", "code": "print('Hello MockMind')"}
        res = client.post("/api/code/run", json=code_payload, headers=headers)
        print(f"[9/9] Code Execution: Status {res.status_code} -> Output: {res.json().get('stdout').strip()}")
        assert res.status_code == 200, "Code run failed"

        # Logout
        res = client.post("/api/logout", headers=headers)
        print(f"[Logout] Status {res.status_code}")
        assert res.status_code == 204, "Logout failed"

    print("=== ALL 9 API INTEGRATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
