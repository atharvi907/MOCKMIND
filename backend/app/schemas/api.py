from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

Text = Annotated[str, Field(strip_whitespace=True)]


class RegisterRequest(BaseModel):
    full_name: Text = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone: str = Field(default="", max_length=30)
    college: str = Field(default="", max_length=160)
    branch: str = Field(default="", max_length=120)
    year: str = Field(default="", max_length=30)
    skills: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(item.strip() for item in values if item.strip()))


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ProfileUpdateRequest(BaseModel):
    full_name: Text | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    college: str | None = Field(default=None, max_length=160)
    branch: str | None = Field(default=None, max_length=120)
    year: str | None = Field(default=None, max_length=30)
    skills: list[str] | None = Field(default=None, max_length=50)
    role: str | None = Field(default=None, max_length=100)
    linkedin: str | None = Field(default=None, max_length=500)
    github: str | None = Field(default=None, max_length=500)

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, values: list[str] | None) -> list[str] | None:
        return list(dict.fromkeys(item.strip() for item in values if item.strip())) if values is not None else values


class InterviewStartRequest(BaseModel):
    domain: Text = Field(min_length=2, max_length=80)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    role: Text = Field(default="Software Engineer", min_length=2, max_length=120)
    interview_type: Literal["standard", "resume"] = "standard"
    question_count: int = Field(default=5, ge=3, le=10)


class AnswerRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=100)
    answer: str = Field(default="", max_length=30000)
    time_taken_sec: int = Field(default=0, ge=0, le=14400)
    language: Literal["python", "java", "cpp"] | None = None
    code: str | None = Field(default=None, max_length=20000)


class FinishRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=100)


class SecurityEventRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=100)
    event_type: Literal[
        "TAB_SWITCH", "WINDOW_BLUR", "FULLSCREEN_EXIT", "SCREENSHOT_SHORTCUT",
        "COPY_ATTEMPT", "CUT_ATTEMPT", "PASTE_ATTEMPT", "CONTEXT_MENU",
        "DEVTOOLS_SIGNAL", "SUSPICIOUS_SHORTCUT",
    ]
    question_number: int = Field(ge=1, le=100)
    event_id: str = Field(min_length=8, max_length=100)


class CodeRunRequest(BaseModel):
    language: Literal["python", "java", "cpp"]
    code: str = Field(min_length=1, max_length=20000)
    session_id: str | None = Field(default=None, min_length=8, max_length=100)
