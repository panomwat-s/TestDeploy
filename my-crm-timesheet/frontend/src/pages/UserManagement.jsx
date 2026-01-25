import { useEffect, useState } from "react";
import { api } from "../services/api.js";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // เพิ่ม state สำหรับเก็บข้อผิดพลาด
  const [form, setForm] = useState({
    username: "",
    email: "",
    role: "User",
  });

  /* ===================== LOAD USERS ===================== */
  async function loadUsers() {
    try {
      setLoading(true);
      const res = await api.get("/users/");

      // เพิ่ม console.log เพื่อตรวจสอบข้อมูลที่ได้รับจาก API
      console.log("Users Response:", res.data);  // เช็กค่าที่ได้รับจาก API

      setUsers(res.data || []); // 🔥 แก้ตรงนี้ (backend ไม่ได้ห่อ data)
    } catch (e) {
      setError("ไม่สามารถโหลดข้อมูลผู้ใช้ได้"); // เก็บข้อผิดพลาด
      console.error(e); // แสดงข้อผิดพลาดในคอนโซล
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

    if (!form.username || !form.email) {
      alert("กรุณากรอก username และ email");
      return;
    }

    try {
      const res = await api.post("/users/", form);

      const tempPassword = res.data.temp_password;

      const copy = window.confirm(
        `สร้างผู้ใช้สำเร็จ 🎉\n\nTemporary Password:\n${tempPassword}\n\nกด OK เพื่อคัดลอก`
      );

      if (copy) {
        await navigator.clipboard.writeText(tempPassword);
        alert("คัดลอกรหัสผ่านแล้ว ✅");
      }


      setForm({ username: "", email: "", role: "User" });
      loadUsers();
    } catch (e) {
      alert(e?.response?.data?.error || "สร้างผู้ใช้ไม่สำเร็จ");
    }
  }

  /* ===================== DELETE ===================== */
  async function deleteUser(id, username) {
    if (!window.confirm(`ต้องการลบผู้ใช้ "${username}" ใช่หรือไม่?`)) return;

    try {
      await api.delete(`/users/${id}`);
      loadUsers();
    } catch (e) {
      alert(e?.response?.data?.error || "ลบผู้ใช้ไม่สำเร็จ");
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
        alert("คัดลอกรหัสผ่านแล้ว");
      }
    } catch (e) {
      alert(e?.response?.data?.error || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
    }
  }

  /* ===================== DISABLE / ENABLE ===================== */
  async function disableUser(id, username) {
    if (!window.confirm(`ปิดการใช้งาน ${username} ?`)) return;

    try {
      await api.post(`/users/${id}/disable`);
      loadUsers();
    } catch (e) {
      alert("ปิดการใช้งานไม่สำเร็จ");
    }
  }

  async function enableUser(id, username) {
    try {
      await api.patch(`/users/${id}/enable`);
      loadUsers();
    } catch (e) {
      alert("เปิดการใช้งานไม่สำเร็จ");
    }
  }

  /* ===================== UI ===================== */
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">User Management</h1>

      {error && (
        <div className="text-red-500">{error}</div>
      )}

      {/* ===== CREATE USER ===== */}
      <form onSubmit={createUser} className="flex gap-2">
        <input
          placeholder="username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          className="border px-2 py-1 rounded"
        />

        <input
          placeholder="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="border px-2 py-1 rounded"
        />

        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="border px-2 py-1 rounded"
        >
          <option>User</option>
          <option>Admin</option>
        </select>

        <button className="bg-green-600 text-white px-4 py-1 rounded">
          Create
        </button>
      </form>

      {/* ===== TABLE ===== */}
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">Username</th>
            <th className="border px-2 py-1">Email</th>
            <th className="border px-2 py-1">Role</th>
            <th className="border px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={4} className="text-center py-4 text-gray-400">
                กำลังโหลด...
              </td>
            </tr>
          )}

          {!loading &&
            users.map((u) => (
              <tr key={u.id}>
                <td className="border px-2 py-1">{u.username}</td>
                <td className="border px-2 py-1">{u.email}</td>
                <td className="border px-2 py-1">{u.role}</td>
                <td className="border px-2 py-1">
                  {u.role !== "Admin" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => resetPassword(u.id, u.username)}
                        className="bg-blue-600 text-white px-2 py-1 rounded text-sm"
                      >
                        Reset
                      </button>

                      {u.is_active ? (
                        <button
                          onClick={() => disableUser(u.id, u.username)}
                          className="bg-yellow-500 text-white px-2 py-1 rounded text-sm"
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          onClick={() => enableUser(u.id, u.username)}
                          className="bg-green-600 text-white px-2 py-1 rounded text-sm"
                        >
                          Enable
                        </button>
                      )}

                      <button
                        onClick={() => deleteUser(u.id, u.username)}
                        className="bg-red-600 text-white px-2 py-1 rounded text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}

          {!loading && users.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center py-4 text-gray-400">
                ไม่มีผู้ใช้งาน
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
