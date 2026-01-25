import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../services/auth";   // ✅ ใช้ helper login()

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      await login({ email, password });     // ✅ จะเก็บ token ให้ใน localStorage
      nav("/dashboard");
    } catch (ex) {
      setErr(ex?.message?.replace(/^"|"$/g, "") || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
  <div className="auth-bg login-page">
    <div className="w-full max-w-3xl mx-auto px-4">
      {/* ==== Card (มีแค่ชั้นเดียว) ==== */}
      <div className="form-container">
        {/* ==== Header Box (ครอบ Welcome + รูป) ==== */}
        <div className="header-box">
          <img
            src="/intelligist.png"   // โลโก้บริษัท
            alt="Company Logo"
            className="header-logo"
          />
          <div className="header-text">
            <p className="header-subtitle">ลงชื่อเข้าใช้งานระบบ</p>
          </div>
        </div>

        {/* ==== Form ==== */}
        <form onSubmit={submit}>
          {err && <div className="alert-error">{err}</div>}

          <div className="form-field">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Password</label>
            <div className="password-container">
              <input
                className="form-input"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="btn-toggle"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="checkbox-container">
            <label className="checkbox-label">
              <input type="checkbox" className="form-checkbox" />
              <span>จำฉันไว้</span>
            </label>           
          </div>

          <button disabled={loading} className="btn-primary">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  </div>
);
}