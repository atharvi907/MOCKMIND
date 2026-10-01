import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8001";
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";
const TOKEN_KEY = "mm_access_token";

export const api = axios.create({ baseURL: API, timeout: 60000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("mm_user");
      Object.keys(sessionStorage).filter((key) => key.startsWith("mm_interview_")).forEach((key) => sessionStorage.removeItem(key));
      window.dispatchEvent(new Event("mm-auth-expired"));
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  signup: async ({ name, email, password }) => (await api.post("/register", { full_name: name, email, password })).data,
  login: async ({ email, password }) => (await api.post("/login", { email, password })).data,
  profile: async () => (await api.get("/profile")).data,
  updateProfile: async (profile) => (await api.put("/profile", profile)).data,
  logout: async () => api.post("/logout"),
  storeToken: (token) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
  hasToken: () => Boolean(localStorage.getItem(TOKEN_KEY)),
};

export const interviewApi = {
  start: async ({ domain, difficulty, role, interview_type = "standard", question_count = 5 }) => (await api.post("/interview/start", { domain, difficulty, role, interview_type, question_count })).data,
  answer: async (payload) => (await api.post("/interview/answer", payload)).data,
  next: async (payload) => (await api.post("/interview/next", payload)).data,
  finish: async (payload) => (await api.post("/interview/finish", payload)).data,
  securityEvent: async (payload) => (await api.post("/interview/security-event", payload)).data,
  get: async (id) => (await api.get(`/interview/${id}`)).data,
  list: async () => (await api.get("/interviews")).data,
  stats: async () => (await api.get("/stats")).data,
  questionBank: async (params) => (await api.get("/question-bank", { params })).data,
  question: async (id) => (await api.get(`/question-bank/${encodeURIComponent(id)}`)).data,
};

export const resumeApi = {
  status: async () => (await api.get("/profile/resume")).data,
  upload: async (file) => {
    const form = new FormData();
    form.append("file", file);
    return (await api.post("/profile/upload-resume", form, { headers: { "Content-Type": "multipart/form-data" } })).data;
  },
};

export const codeApi = {
  run: async (payload) => (await api.post("/code/run", payload)).data,
};
