def public_user(user: dict) -> dict:
    return {
        "id": user["_id"], "name": user["fullName"], "full_name": user["fullName"], "fullName": user["fullName"],
        "email": user["email"], "phone": user.get("phone", ""), "college": user.get("college", ""),
        "branch": user.get("branch", ""), "year": user.get("year", ""), "skills": user.get("skills", []),
        "role": user.get("role", "student"), "profileImage": user.get("profileImage", ""),
        "profile_image": user.get("profileImage", ""), "resume": user.get("resume", ""),
        "linkedin": user.get("linkedin", ""), "github": user.get("github", ""),
        "isVerified": user.get("isVerified", False), "isActive": user.get("isActive", True),
    }
