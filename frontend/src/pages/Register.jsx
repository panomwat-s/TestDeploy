// src/pages/Register.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register as registerUser } from "../services/auth";

export default function Register() {
  const nav = useNavigate();

  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // helper อัปเดตฟิลด์ใน form
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await registerUser(form);   // POST /auth/register
      nav("/login");              // สมัครเสร็จไปหน้า Login
    } catch (ex) {
      setErr(ex?.response?.data?.error || ex?.message || "Register failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-bg register-page">
      <div className="form-container">
        <div className="header-box">
          <img src="/intelligist.png" alt="Company Logo" className="header-logo" />
          <div className="header-text">
            <h1 className="header-title">สมัครสมาชิก</h1>
            <p className="header-subtitle">สร้างบัญชีใหม่ของคุณ</p>
          </div>
        </div>

        <form onSubmit={submit} noValidate>
          {err && <div className="alert-error">{err}</div>}

          <div className="form-field">
            <label className="form-label" htmlFor="reg-username">Username</label>
            <input
              id="reg-username"
              className="form-input"
              type="text"
              placeholder="yourname"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              required
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              className="form-input"
              type="email"
              placeholder="you@email.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <div className="password-container">
              <input
                id="reg-password"
                className="form-input"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="btn-toggle"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button disabled={loading} className="btn-primary">
            {loading ? "Creating…" : "Create account"}
          </button>

          <p className="form-text">
            มีบัญชีแล้ว? <Link to="/login" className="form-link">เข้าสู่ระบบ</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
