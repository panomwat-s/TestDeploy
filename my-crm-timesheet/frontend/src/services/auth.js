import { api } from "./api";

export async function login(data) {
  const res = await api.post("/auth/login", data);   // ไม่ต้องใส่ /api ซ้ำ
  const { token, user } = res.data || {};
  if (token) localStorage.setItem("mycase_token", token);
  if (user)  localStorage.setItem("user", JSON.stringify(user));
  return user;
}
export async function register(data) {
  await api.post("/auth/register", { role: "User", ...data });
}
export async function me() {
  const res = await api.get("/auth/me");
  return res.data?.user;
}
export function logout() {
  localStorage.removeItem("mycase_token");
  localStorage.removeItem("user");
}
