import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { UserPlus, RefreshCw, Ban, CheckCircle, Trash2 } from "lucide-react";
import "../assign.css";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    username: "",
    email: "",
    role: "user",
  });

  /* ===================== LOAD USERS ===================== */
  async function loadUsers() {
    try {
      setLoading(true);
      const res = await api.get("/users");
      console.log("Users data:", res.data); // ดูข้อมูลที่ได้
      setUsers(res.data || []);
    } catch (e) {
      setError("ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
      console.error("Load users error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  /* ===================== CREATE USER ===================== */
  async function createUser(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.username || !form.email) {
      setError("กรุณากรอก username และ email");
      return;
    }

    try {
      const res = await api.post("/users", {
        ...form,
        role: form.role.toLowerCase(), // ⭐ แปลง role เป็น lowercase
      });
      const tempPassword = res.data.temp_password;

      const copy = window.confirm(
        `สร้างผู้ใช้สำเร็จ 🎉\n\nTemporary Password:\n${tempPassword}\n\nกด OK เพื่อคัดลอก`
      );

      if (copy) {
        await navigator.clipboard.writeText(tempPassword);
        setSuccess("สร้างผู้ใช้สำเร็จและคัดลอกรหัสผ่านแล้ว ✅");
      } else {
        setSuccess("สร้างผู้ใช้สำเร็จ");
      }

      setForm({ username: "", email: "", role: "user" });
      loadUsers();
    } catch (e) {
      setError(e?.response?.data?.error || "สร้างผู้ใช้ไม่สำเร็จ");
    }
  }

  /* ===================== DELETE ===================== */
  async function deleteUser(id, username) {
    if (!window.confirm(`ต้องการลบผู้ใช้ "${username}" ใช่หรือไม่?`)) return;

    try {
      await api.delete(`/users/${id}`);
      setSuccess(`ลบผู้ใช้ "${username}" สำเร็จ`);
      loadUsers();
    } catch (e) {
      setError(e?.response?.data?.error || "ลบผู้ใช้ไม่สำเร็จ");
    }
  }

  /* ===================== RESET PASSWORD ===================== */
  async function resetPassword(id, username) {
    if (!window.confirm(`รีเซ็ตรหัสผ่านของ "${username}" ?`)) return;

    try {
      const res = await api.post(`/users/${id}/reset`);
      const tempPassword = res.data.temp_password;

      const copy = window.confirm(
        `Temporary Password: ${tempPassword}\n\nกด OK เพื่อคัดลอก`
      );

      if (copy) {
        await navigator.clipboard.writeText(tempPassword);
        setSuccess("รีเซ็ตรหัสผ่านและคัดลอกแล้ว");
      } else {
        setSuccess("รีเซ็ตรหัสผ่านสำเร็จ");
      }
    } catch (e) {
      setError(e?.response?.data?.error || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
    }
  }

  /* ===================== DISABLE / ENABLE ===================== */
  async function disableUser(id, username) {
    if (!window.confirm(`ปิดการใช้งาน ${username} ?`)) return;

    try {
      await api.post(`/users/${id}/disable`);
      setSuccess(`ปิดการใช้งาน "${username}" แล้ว`);
      loadUsers();
    } catch (e) {
      setError("ปิดการใช้งานไม่สำเร็จ");
    }
  }

  async function enableUser(id, username) {
    try {
      await api.patch(`/users/${id}/enable`);
      setSuccess(`เปิดการใช้งาน "${username}" แล้ว`);
      loadUsers();
    } catch (e) {
      setError("เปิดการใช้งานไม่สำเร็จ");
    }
  }

  /* ===================== UI ===================== */

  // แปลง role เป็นภาษาไทย
  const roleLabel = (role) => {
    switch ((role || "").toLowerCase()) {
      case "admin":
        return "ผู้ดูแลระบบ";
      case "user":
        return "ผู้ใช้งาน";
      default:
        return "-";
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header - แบบ Assign */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              User Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              จัดการผู้ใช้งานในระบบ • {loading ? "กำลังโหลด…" : `พบ ${users.length} ผู้ใช้`}
            </p>
          </div>
        </header>

        {/* Alert Messages */}
        {error && <div className="alert-error">{error}</div>}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {/* Form Card - แบบ Assign */}
        <section className="card">
          <div className="card-header">
            <div className="card-dot" />
            <h2 className="card-title">เพิ่มผู้ใช้ใหม่</h2>
          </div>

          <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="form-label">Username</label>
              <input
                placeholder="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="form-input bg-white"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>

              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="bg-blue-600 text-white rounded px-4 py-2 text-sm inline-flex items-center justify-center hover:bg-blue-700 w-full"
              >
                <UserPlus size={14} className="mr-2" />
                เพิ่มผู้ใช้
              </button>
            </div>
          </form>
        </section>

        {/* Table */}
        <section className="card-table">
          <div className="card-table-head">
            <h3 className="card-table-title">รายการผู้ใช้</h3>
            <span className="card-table-meta">แสดง {users.length} ผู้ใช้</span>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Username</th>
                  <th className="th">Email</th>
                  <th className="th">Role</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      ไม่มีผู้ใช้งาน
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td className="td font-medium text-gray-900">{u.username}</td>
                      <td className="td">{u.email}</td>
                      <td className="td">
                        <span
                          className={
                            "priority-badge " +
                            (u.role?.toLowerCase() === "admin"
                              ? "priority-high"
                              : "priority-medium")
                          }
                        >
                          {roleLabel(u.role)}
                        </span>
                      </td>
                      <td className="td">
                        {u.role?.toLowerCase() !== "admin" ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => resetPassword(u.id, u.username)}
                              className="btn-secondary inline-flex items-center gap-1 text-xs"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Reset
                            </button>

                            {u.is_active ? (
                              <button
                                onClick={() => disableUser(u.id, u.username)}
                                className="btn-secondary inline-flex items-center gap-1 text-xs"
                              >
                                <Ban className="w-3 h-3" />
                                Disable
                              </button>
                            ) : (
                              <button
                                onClick={() => enableUser(u.id, u.username)}
                                className="btn-secondary inline-flex items-center gap-1 text-xs"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Enable
                              </button>
                            )}

                            <button
                              onClick={() => deleteUser(u.id, u.username)}
                              className="icon-danger text-xs"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}