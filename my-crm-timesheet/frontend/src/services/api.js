// src/services/api.js
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:5000/api", // ปรับให้ตรงของคุณ
});

// แนบ JWT อัตโนมัติ
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("mycase_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// จัดการ 401 (ถ้าอยากเด้งไปหน้า login)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      // window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);
