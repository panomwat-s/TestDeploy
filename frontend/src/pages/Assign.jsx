import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { Loader2, Plus, Filter } from "lucide-react";
import "../assign.css";

export default function Assign() {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // แปลงความสำคัญเป็นภาษาไทย
  const priorityLabel = (p) => {
    switch (p) {
      case "High": return "เร่งด่วน";
      case "Medium": return "ปานกลาง";
      case "Low": return "ต่ำ";
      default: return "-";
    }
  };

  // แปลงชื่อความสำคัญสำหรับ Filter button
  const priorityFilterLabel = (p) => {
    switch (p) {
      case "All": return "ทั้งหมด";
      case "High": return "เร่งด่วน";
      case "Medium": return "ปานกลาง";
      case "Low": return "ต่ำ";
      default: return p;
    }
  };

  // แปลงสถานะเป็นภาษาไทย
  const statusLabel = (s) => {
    const normalized = (s || "open").toLowerCase().replace(/\s+/g, "_");
    switch (normalized) {
      case "open": return "เปิดงาน";
      case "in_progress": return "ระหว่างดำเนินการ";
      case "resolved": return "เสร็จสิ้น";
      case "complete": return "เสร็จสิ้น";
      case "closed": return "ปิดงาน";
      default: return "-";
    }
  };

  const [form, setForm] = useState({
    title: "",
    assignee_id: "",
    due_date: "",
    priority: "Medium",
    details: "",
  });

  // ฟังก์ชันสำหรับ format วันที่เป็น YYYY-MM-DD
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // โหลด user (role=User)
  async function fetchMembers() {
    try {
      const res = await api.get("/users/", { params: { role: "User" } });
      setMembers(res.data);
      if (res.data.length) {
        setForm(f => ({ ...f, assignee_id: String(res.data[0].id) }));
      }
    } catch {
      setError("โหลดรายชื่อผู้ใช้งานไม่สำเร็จ");
    }
  }

  // โหลด tasks
  async function fetchTasks() {
    setLoading(true);
    try {
      const res = await api.get("/tasks/", {
        params: {
          sort: "-created_at",
          priority: priorityFilter !== "All" ? priorityFilter : undefined,
          search: query || undefined,
        }
      });
      setTasks(res.data.data);
    } catch {
      setError("โหลดรายการงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.assignee_id || !form.due_date) return;

    setSubmitting(true);
    try {
      await api.post("/tasks/", {
        ...form,
        assignee_id: Number(form.assignee_id),
        due_date: form.due_date || null,
      });
      setForm(f => ({ ...f, title: "", details: "", due_date: "" }));
      fetchTasks();
    } catch {
      setError("สร้างงานไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id) {
    if (!confirm("ลบงานนี้?")) return;
    await api.delete(`/tasks/${id}`);
    fetchTasks();
  }

  useEffect(() => {
    fetchMembers();
    fetchTasks();
  }, [query, priorityFilter]);

  const filtered = useMemo(() => tasks, [tasks]);

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Assign
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              จัดการมอบหมายงานให้ทีม • {loading ? "กำลังโหลด…" : `พบ ${filtered.length} รายการ`}
            </p>
          </div>
          {/* Quick Filter badge-style */}
          <div className="hidden md:flex items-center gap-2">
            {["All", "Low", "Medium", "High"].map(p => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`chip ${priorityFilter === p ? "chip-active" : ""}`}
              >
                <Filter size={14} className="mr-1" /> {priorityFilterLabel(p)}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <div className="alert-error">
            {error}
          </div>
        )}

        {/* Form Card */}
        <section className="card">
          <div className="card-header">
            <div className="card-dot" />
            <h2 className="card-title">เพิ่มงานใหม่</h2>
          </div>

          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                หัวข้องาน <span className="text-red-500">*</span>
              </label>
              <input
                className="form-input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="เช่น: สร้างหน้า Assign UI"
                required
              />
            </div>

            <div>
              <label className="form-label">
                ผู้รับผิดชอบ <span className="text-red-500">*</span>
              </label>
              <select
                className="form-input bg-white"
                value={form.assignee_id}
                onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
                required
              >
                <option value="">-- เลือกผู้รับผิดชอบ --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.username || m.name || m.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">
                กำหนดส่ง <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                min={getTodayDate()}
                required
              />
            </div>

            <div>
              <label className="form-label">ความสำคัญ</label>
              <select
                className="form-input bg-white"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {["Low", "Medium", "High"].map(p => (
                  <option key={p} value={p}>{priorityLabel(p)}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="form-label">รายละเอียด</label>
              <textarea
                rows="5"
                className="form-input"
                value={form.details}
                onChange={(e) => setForm({ ...form, details: e.target.value })}
                placeholder="รายละเอียดงานเพิ่มเติม (ถ้ามี)"
                style={{ resize: "none" }}
              />
            </div>

            {/* ปุ่มเล็ก + อยู่กลาง */}
            <div className="md:col-span-2 flex justify-center pt-2">
              <button
                type="submit"
                disabled={!form.title.trim() || !form.assignee_id || !form.due_date || submitting}
                className="bg-blue-600 text-white rounded px-4 py-2 text-sm inline-flex items-center justify-center hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="animate-spin mr-2" size={14} />
                ) : (
                  <Plus size={14} className="mr-2" />
                )}
                {submitting ? "กำลังบันทึก…" : "บันทึกงาน"}
              </button>
            </div>
          </form>
        </section>

        {/* Toolbar */}

        {/* Latest table (สไตล์เดียวกับ Dashboard) */}
        <section className="card-table">
          <div className="card-table-head">
            <h3 className="card-table-title">รายการงานล่าสุด</h3>
            <span className="card-table-meta">
              แสดง {Math.min(filtered.length, 10)} จาก {filtered.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">รหัส</th>
                  <th className="th">หัวข้อ</th>
                  <th className="th">ผู้รับผิดชอบ</th>
                  <th className="th">ความสำคัญ</th>
                  <th className="th">สถานะ</th>
                  <th className="th">วันกำหนด</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">กำลังโหลด…</td>
                  </tr>
                ) : filtered.slice(0, 10).map((t) => (
                  <tr key={t.id}>
                    <td className="td">{t.task_code || `TS-${String(t.id).padStart(4, "0")}`}</td>
                    <td className="td font-medium text-gray-900">{t.title}</td>
                    <td className="td">{t.assignee_name || t.assignee?.name || "-"}</td>
                    <td className="td">
                      <span style={{
                        color: t.priority === "High" ? "#dc2626" :
                          t.priority === "Medium" ? "#f59e0b" : "#10b981",
                        fontWeight: 500,
                        fontSize: "0.875rem"
                      }}>
                        {priorityLabel(t.priority)}
                      </span>
                    </td>
                    <td className="td">
                      <span style={{
                        color: ((t.status || "open").toLowerCase().replace(/\s+/g, "_") === "resolved" ||
                          (t.status || "open").toLowerCase().replace(/\s+/g, "_") === "complete" ||
                          (t.status || "open").toLowerCase().replace(/\s+/g, "_") === "closed") ? "#10b981" :
                          (t.status || "open").toLowerCase().replace(/\s+/g, "_") === "in_progress" ? "#f59e0b" :
                            "#dc2626",
                        fontWeight: 500,
                        fontSize: "0.875rem"
                      }}>
                        {statusLabel(t.status)}
                      </span>
                    </td>
                    <td className="td">{t.due_date ? ("" + t.due_date).slice(0, 10) : "-"}</td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">ยังไม่มีงาน</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{children}</th>
  );
}
function Td({ children, className = "" }) {
  return (
    <td className={"px-4 py-3 text-gray-700 whitespace-nowrap " + className}>{children}</td>
  );
}
function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-gray-100 text-gray-700",
    sky: "bg-sky-50 text-sky-700",
    indigo: "bg-indigo-50 text-indigo-700",
    violet: "bg-purple-50 text-purple-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}