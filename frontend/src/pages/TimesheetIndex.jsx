// src/pages/TimesheetList.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api";
import { Trash2, X, Eye } from "lucide-react";
import "../assign.css";

export default function TimesheetList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [activeTask, setActiveTask] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // ← เพิ่ม
  const editorRef = useRef(null);

  // แปลงความสำคัญเป็นภาษาไทย
  const priorityLabel = (p) => {
    switch (p) {
      case "High": return "เร่งด่วน";
      case "Medium": return "ปานกลาง";
      case "Low": return "ต่ำ";
      default: return "-";
    }
  };

  // แปลงสถานะเป็นภาษาไทย
  const statusLabel = (s) => {
    const normalized = (s || "Open").toLowerCase().replace(/\s+/g, "_");
    switch (normalized) {
      case "open": return "เปิดงาน";
      case "in_progress": return "ระหว่างดำเนินการ";
      case "complete": return "เสร็จสิ้น";
      case "closed": return "ปิดงาน";
      case "cancelled": return "ยกเลิก";
      default: return s || "-";
    }
  };

  // ดึงข้อมูล current user ← เพิ่ม
  async function fetchCurrentUser() {
    try {
      const res = await api.get("/auth/me");
      setCurrentUser(res.data.user);
    } catch {
      setErr("โหลดข้อมูลผู้ใช้ไม่สำเร็จ");
    }
  }

  async function fetchTasks() {
    try {
      setLoading(true);
      setErr("");
      const isUser = currentUser?.role?.toLowerCase() === "user";
      const res = await api.get("/tasks/", {
        params: {
          sort: "-created_at",
          page_size: 50,
          assignee_id: isUser ? currentUser.id : undefined, // ← user เห็นแค่งานตัวเอง
        }
      });
      setTasks(res.data?.data || []);
    } catch (e) {
      setErr(e?.response?.data?.error || "โหลดรายการงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  // โหลด currentUser ครั้งแรก ← เพิ่ม
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // โหลด tasks หลังได้ currentUser ← แก้
  useEffect(() => {
    if (currentUser) fetchTasks();
  }, [currentUser]);

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
    } catch (_) { }
  }

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Time Sheet
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              เลือกงานที่ต้องการบันทึกเวลา • {loading ? "กำลังโหลด…" : `พบ ${tasks.length} รายการ`}
            </p>
          </div>
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
                  <th className="th">การดำเนินการ</th>
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
                      <td className="td">
                        <button onClick={() => openEditor(t)} className="btn-secondary">
                          ดำเนินการบันทึกงาน
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
              statusLabel={statusLabel}
            />
          </section>
        )}
      </div>
    </div>
  );
}

/* ================= Components ================= */

function InlineTimesheetEditor({ task, onClose, onSaved, onClosed, statusLabel }) {
  const createNewRow = () => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const currentDate = now.toISOString().split('T')[0];
    return {
      work_date: currentDate,
      start_time: currentTime,
      end_time: "",
      detail: ""
    };
  };

  const [rows, setRows] = useState([createNewRow()]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [timesheets, setTimesheets] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function fetchTimesheets() {
    try {
      setLoadingHistory(true);
      const res = await api.get("/timesheet/", { params: { task_id: task.id } });
      setTimesheets(res.data?.items || []);
    } catch (e) {
      console.error("โหลด timesheet ไม่สำเร็จ", e);
      setTimesheets([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    fetchTimesheets();
  }, [task.id]);

  function onChange(i, key, val) {
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  }

  function addRow() {
    setRows(rs => [...rs, createNewRow()]);
  }

  function removeRow(i) {
    setRows(rs => rs.filter((_, idx) => idx !== i));
  }

  const hasOverlap = useMemo(() => {
    const groups = new Map();
    rows.forEach(r => {
      if (!r.work_date || !r.start_time || !r.end_time) return;
      const key = r.work_date;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push([r.start_time, r.end_time]);
    });
    for (const [, list] of groups) {
      list.sort((a, b) => a[0].localeCompare(b[0]));
      for (let i = 0; i < list.length - 1; i++) if (list[i][1] > list[i + 1][0]) return true;
    }
    return false;
  }, [rows]);

  async function saveAll() {
    setErr(""); setMsg("");
    const entries = rows
      .filter(r => r.work_date && r.start_time && r.end_time)
      .map(r => ({
        task_id: task.id,
        work_date: r.work_date,
        start_time: r.start_time,
        end_time: r.end_time,
        note: (r.detail || "").trim(),
      }));

    if (!entries.length) return setErr("กรอกข้อมูลวันที่/เวลาให้ครบอย่างน้อย 1 แถว");
    if (hasOverlap) return setErr("ช่วงเวลาในวันเดียวกันซ้อนทับกัน กรุณาแก้ไข");

    try {
      setSaving(true);
      await api.post("/timesheet/bulk", { entries });
      setMsg("บันทึกสำเร็จ");
      setRows([createNewRow()]);
      await fetchTimesheets();
      onSaved && (await onSaved());
    } catch (e) {
      setErr(e?.response?.data?.error || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function closeTask() {
    try {
      setSaving(true);
      await api.patch(`/tasks/${task.id}`, { status: "Complete" });
      setMsg("ปิดงานแล้ว");
      onClosed && (await onClosed());
    } catch (e) {
      setErr(e?.response?.data?.error || "ปิดงานไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="card-dot" />
            <div>
              <h3 className="card-title">Timesheet</h3>
              <p className="text-xs text-gray-500 mt-1">
                รหัส {task.task_code || `TS-${String(task.id).padStart(4, "0")}`} • ผู้รับผิดชอบ {task.assignee_name || task.assignee?.name || "-"} • สถานะ <strong>{statusLabel(task.status)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="btn-secondary inline-flex items-center justify-center gap-1 min-w-[120px]"
            >
              <Eye className="w-4 h-4" /> {showHistory ? "ซ่อนประวัติ" : "ดูประวัติ"}
            </button>
            {task.status !== "Complete" && (
              <button onClick={closeTask} className="btn-secondary inline-flex items-center justify-center gap-1 min-w-[120px]">
                ปิดงาน
              </button>
            )}
            <button onClick={onClose} className="btn-secondary inline-flex items-center justify-center gap-1 min-w-[120px]">
              <X className="w-4 h-4" /> ปิดฟอร์ม
            </button>
          </div>
        </div>
      </div>

      {err && <div className="alert-error mb-3">{err}</div>}
      {msg && <div className="mb-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-2xl p-3 text-sm">{msg}</div>}

      {/* ประวัติการบันทึกเวลา */}
      {showHistory && (
        <div className="mb-4 border-b border-gray-200 pb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 px-5">ประวัติการบันทึกเวลา</h4>
          {loadingHistory ? (
            <div className="px-5 py-4 text-center text-gray-400">กำลังโหลด...</div>
          ) : timesheets.length === 0 ? (
            <div className="px-5 py-4 text-center text-gray-400">ยังไม่มีการบันทึก</div>
          ) : (
            <div className="overflow-x-auto px-5">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="th" style={{ minWidth: '200px' }}>รายละเอียด</th>
                    <th className="th" style={{ minWidth: '150px' }}>บันทึกเมื่อ</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheets.map(x => (
                    <tr key={x.id}>
                      <td className="td" style={{ maxWidth: '400px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {x.notes || x.note || "-"}
                      </td>
                      <td className="td">
                        {x.created_at
                          ? (() => {
                            const date = new Date(new Date(x.created_at).getTime() + (7 * 60 * 60 * 1000));
                            const day = String(date.getDate()).padStart(2, '0');
                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const month = monthNames[date.getMonth()];
                            const year = date.getFullYear();
                            const time = date.toTimeString().slice(0, 5);
                            return `${day}/${month}/${year} ${time}`;
                          })()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card-table !p-0 !shadow-none !border-0">
        <div className="card-table-head">
          <h4 className="card-table-title">ตารางบันทึกเวลา</h4>
          <div className="flex items-center gap-2">
            <button onClick={addRow} className="btn-secondary inline-flex items-center justify-center gap-1 w-32">
              เพิ่มแถว
            </button>
            <button onClick={saveAll} disabled={saving} className="btn-secondary inline-flex items-center justify-center gap-1 w-32">
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
                    <input
                      type="date"
                      className="form-input"
                      value={r.work_date}
                      onChange={(e) => onChange(i, "work_date", e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </td>
                  <td className="td">
                    <input
                      type="time"
                      className="form-input"
                      value={r.start_time}
                      onChange={(e) => onChange(i, "start_time", e.target.value)}
                      step="900"
                    />
                  </td>
                  <td className="td">
                    <input
                      type="time"
                      className="form-input"
                      value={r.end_time}
                      onChange={(e) => onChange(i, "end_time", e.target.value)}
                      step="900"
                    />
                  </td>
                  <td className="td">
                    <input className="form-input" placeholder="รายละเอียดงานช่วงเวลานี้…"
                      value={r.detail} onChange={(e) => onChange(i, "detail", e.target.value)} />
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
  );
}