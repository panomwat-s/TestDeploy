// src/pages/TimesheetList.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api";
import { Plus, Trash2, Calendar, Clock3, X } from "lucide-react";
import "../assign.css";

export default function TimesheetList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [activeTask, setActiveTask] = useState(null);
  const editorRef = useRef(null);

  async function fetchTasks() {
    try {
      setLoading(true);
      setErr("");
      const res = await api.get("/tasks/", { params: { sort: "-created_at", page_size: 50 } });
      setTasks(res.data?.data || []);
    } catch (e) {
      setErr(e?.response?.data?.error || "โหลดรายการงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTasks(); }, []);

  function openEditor(t) {
    setActiveTask(t);
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  // รีเฟรชรายการ task 1 รายการ (หลังบันทึกเวลา/ปิดงาน)
  async function refreshTaskRow(taskId) {
    try {
      const res = await api.get(`/tasks/${taskId}`);
      const updated = res.data?.data;
      if (!updated) return;
      setTasks(prev => prev.map(x => (x.id === taskId ? updated : x)));
      setActiveTask(prev => (prev && prev.id === taskId ? updated : prev));
    } catch (_) {}
  }

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Time Sheet</h1>
          <p className="text-gray-500 text-sm">เลือกงานที่ต้องการบันทึกเวลา (กด “บันทึกเวลา” แล้วฟอร์มจะแสดงด้านล่าง)</p>
        </header>

        {err && <div className="alert-error">{err}</div>}

        {/* ตารางงาน */}
        <section className="card-table">
          <div className="card-table-head">
            <h3 className="card-table-title">รายการงาน</h3>
            <span className="card-table-meta">แสดง {tasks.length} รายการ</span>
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
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">กำลังโหลด…</td></tr>
                ) : tasks.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">ยังไม่มีงาน</td></tr>
                ) : (
                  tasks.map(t => (
                    <tr key={t.id}>
                      <td className="td">{t.task_code || `TS-${String(t.id).padStart(4,"0")}`}</td>
                      <td className="td font-medium text-gray-900">{t.title}</td>
                      <td className="td">{t.assignee_name || t.assignee?.name || "-"}</td>
                      <td className="td">
                        <span className={
                          "priority-badge " + (t.priority === "High"
                            ? "priority-high" : t.priority === "Medium"
                            ? "priority-medium" : "priority-low")
                        }>{t.priority}</span>
                      </td>
                      <td className="td"><StatusBadge status={t.status} /></td>
                      <td className="td">{t.due_date ? (""+t.due_date).slice(0,10) : "-"}</td>
                      <td className="td">
                        <button onClick={() => openEditor(t)} className="btn-secondary">
                          บันทึกเวลา
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Inline editor */}
        {activeTask && (
          <section ref={editorRef}>
            <InlineTimesheetEditor
              task={activeTask}
              onClose={() => setActiveTask(null)}
              onSaved={async () => { await refreshTaskRow(activeTask.id); }}
              onClosed={async () => { await refreshTaskRow(activeTask.id); }}
            />
          </section>
        )}
      </div>
    </div>
  );
}

/* ================= Components ================= */

function StatusBadge({ status }) {
  const s = status || "Open";
  const label =
    s === "In Progress" ? "กำลังดำเนินการ" :
    s === "Complete" ? "Complete" :
    s === "Cancelled" ? "ยกเลิก" : "Open";

  const tone =
    s === "In Progress" ? "priority-medium" :
    s === "Complete" ? "priority-high" :
    s === "Cancelled" ? "priority-low" : "priority-low";

  return <span className={`priority-badge ${tone}`}>{label}</span>;
}

function InlineTimesheetEditor({ task, onClose, onSaved, onClosed }) {
  const [rows, setRows] = useState([{ work_date: "", start_time: "", end_time: "", detail: "" }]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function onChange(i, key, val) {
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  }
  function addRow() { setRows(rs => [...rs, { work_date: "", start_time: "", end_time: "", detail: "" }]); }
  function removeRow(i) { setRows(rs => rs.filter((_, idx) => idx !== i)); }

  // ตรวจเวลา “ชน” ภายในฟอร์มเดียวกัน
  const hasOverlap = useMemo(() => {
    const groups = new Map();
    rows.forEach(r => {
      if (!r.work_date || !r.start_time || !r.end_time) return;
      const key = r.work_date;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push([r.start_time, r.end_time]);
    });
    for (const [, list] of groups) {
      list.sort((a,b) => a[0].localeCompare(b[0]));
      for (let i=0;i<list.length-1;i++) if (list[i][1] > list[i+1][0]) return true;
    }
    return false;
  }, [rows]);

  async function saveAll() {
    setErr(""); setMsg("");
    const entries = rows
      .filter(r => r.work_date && r.start_time && r.end_time)
      .map(r => ({
        task_id: task.id,
        work_date: r.work_date,      // "YYYY-MM-DD"
        start_time: r.start_time,    // "HH:MM"
        end_time: r.end_time,        // "HH:MM"
        note: (r.detail || "").trim(),
      }));

    if (!entries.length) return setErr("กรอกข้อมูลวันที่/เวลาให้ครบอย่างน้อย 1 แถว");
    if (hasOverlap)   return setErr("ช่วงเวลาในวันเดียวกันซ้อนทับกัน กรุณาแก้ไข");

    try {
      setSaving(true);
      // ✅ ยิง API จริง (ตาม BE: url_prefix="/api/timesheet")
      await api.post("/timesheet/bulk", { entries });

      // BE จะอัปเดต Open -> In Progress ให้อัตโนมัติ
      setMsg("บันทึกสำเร็จ");
      setRows([{ work_date: "", start_time: "", end_time: "", detail: "" }]);
      onSaved && (await onSaved());
    } catch (e) {
      setErr(e?.response?.data?.error || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  // ปิดงาน => Complete
  async function closeTask() {
    try {
      setSaving(true);
      await api.patch(`/tasks${task.id}`, { status: "Complete" });
      setMsg("ปิดงานแล้ว");
      onClosed && (await onClosed());
    } catch (e) {
      setErr(e?.response?.data?.error || "ปิดงานไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-5 py-4 flex items-center justify-between border-b">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Timesheet</h3>
          <p className="text-xs text-gray-500">
            รหัส {task.task_code || `TS-${String(task.id).padStart(4,"0")}`} • ผู้รับผิดชอบ {task.assignee_name || task.assignee?.name || "-"} • สถานะ <strong>{task.status}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {task.status !== "Complete" && (
            <button onClick={closeTask} className="btn-primary">ปิดงาน (Complete)</button>
          )}
          <button onClick={onClose} className="btn-secondary inline-flex items-center gap-1">
            <X className="w-4 h-4" /> ปิดฟอร์ม
          </button>
        </div>
      </div>

      <div className="p-5">
        {err && <div className="alert-error mb-3">{err}</div>}
        {msg && <div className="mb-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-2xl p-3 text-sm">{msg}</div>}

        <div className="card-table !p-0 !shadow-none !border-0">
          <div className="card-table-head">
            <h4 className="card-table-title">ตารางบันทึกเวลา</h4>
            <div className="flex items-center gap-2">
              <button onClick={addRow} className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> เพิ่มแถว
              </button>
              <button onClick={saveAll} disabled={saving} className="btn-secondary">
                {saving ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">วันที่ทำงาน</th>
                  <th className="th">เวลาเริ่มต้น</th>
                  <th className="th">เวลาสิ้นสุด</th>
                  <th className="th">รายละเอียด</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="td">
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="date" className="form-input pl-9" value={r.work_date}
                               onChange={(e)=>onChange(i,"work_date",e.target.value)} />
                      </div>
                    </td>
                    <td className="td">
                      <div className="relative">
                        <Clock3 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="time" className="form-input pl-9" value={r.start_time}
                               onChange={(e)=>onChange(i,"start_time",e.target.value)} />
                      </div>
                    </td>
                    <td className="td">
                      <div className="relative">
                        <Clock3 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="time" className="form-input pl-9" value={r.end_time}
                               onChange={(e)=>onChange(i,"end_time",e.target.value)} />
                      </div>
                    </td>
                    <td className="td">
                      <input className="form-input" placeholder="รายละเอียดงานช่วงเวลานี้…"
                             value={r.detail} onChange={(e)=>onChange(i,"detail",e.target.value)} />
                    </td>
                    <td className="td">
                      <button onClick={() => removeRow(i)} className="icon-danger">
                        <Trash2 className="w-4 h-4" /> ลบ
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">ยังไม่มีแถว</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {hasOverlap && (
            <div className="mt-3 text-xs text-rose-600">
              ⚠ พบช่วงเวลาซ้อนทับกันในวันเดียวกัน กรุณาแก้ไขก่อนบันทึก
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */
function timeDiffHours(start, end) {
  const a = new Date(`1970-01-01T${start}:00`);
  const b = new Date(`1970-01-01T${end}:00`);
  return Math.max(0, (b - a) / 3600000);
}
