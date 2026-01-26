// src/pages/Timesheet.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import { Plus, Trash2, Save } from "lucide-react";
import "../assign.css";

export default function Timesheet() {
  const { taskId } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [rows, setRows] = useState([{ work_date: "", start_time: "", end_time: "", detail: "" }]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // สำหรับบันทึก
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

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

  // guard: ถ้าเข้ามาแบบไม่มี taskId ให้กลับ index
  useEffect(() => {
    if (!taskId) navigate("/timesheet", { replace: true });
  }, [taskId, navigate]);

  // โหลดข้อมูลงาน
  useEffect(() => {
    if (!taskId) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await api.get(`/tasks/${taskId}`);
        if (!mounted) return;
        const data = res.data?.data || null;
        if (!data) {
          navigate("/timesheet", { replace: true });
          return;
        }
        setTask(data);
      } catch (e) {
        setErr(e?.response?.data?.error || "โหลดงานไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [taskId, navigate]);

  // โหลด timesheet เดิมของงานนี้
  useEffect(() => {
    if (!taskId) return;
    reloadLogs(taskId);
  }, [taskId]);

  async function reloadLogs(tid) {
    try {
      const res = await api.get("/timesheet", { params: { task_id: tid } });
      setLogs(res.data?.items || []);
    } catch {
      setLogs([]);
    }
  }

  function addRow() {
    setRows((r) => [...r, { work_date: "", start_time: "", end_time: "", detail: "" }]);
  }
  function removeRow(idx) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }
  function updateRow(idx, key, value) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  }

  const hhmmToMin = (t) => {
    if (!t || !/^\d{2}:\d{2}$/.test(t)) return NaN;
    const [h, m] = t.split(":").map((x) => parseInt(x, 10));
    return h * 60 + m;
  };

  // validation เบื้องต้น
  const problems = useMemo(() => {
    const issues = [];
    rows.forEach((row, i) => {
      if (!row.work_date || !row.start_time || !row.end_time) {
        issues.push(`แถว ${i + 1}: กรุณากรอกวันที่/เวลาให้ครบ`);
        return;
      }
      const s = hhmmToMin(row.start_time);
      const e = hhmmToMin(row.end_time);
      if (Number.isNaN(s) || Number.isNaN(e)) {
        issues.push(`แถว ${i + 1}: รูปแบบเวลาไม่ถูกต้อง`);
      }
    });
    return issues;
  }, [rows]);

  async function saveAll() {
    setErr(""); setMsg("");

    if (!task) {
      setErr("ไม่พบงานที่เลือก");
      return;
    }

    const raw = rows.filter(r => r.work_date && r.start_time && r.end_time);
    if (!raw.length) {
      setErr("กรุณากรอกอย่างน้อย 1 แถวให้ครบ (วันที่/เวลาเริ่ม/เวลาสิ้นสุด)");
      return;
    }

    const entries = raw.map(r => ({
      task_id: Number(task.id),
      work_date: r.work_date,
      start_time: r.start_time,
      end_time: r.end_time,
      note: (r.detail || "").trim(),
    }));

    try {
      setSaving(true);

      // 1) พยายาม bulk ก่อน
      let bulkOk = false;
      try {
        await api.post("/timesheet/bulk", { entries });
        bulkOk = true;
      } catch (bulkErr) {
        console.warn("bulk failed → fallback per row", bulkErr?.response?.status, bulkErr?.response?.data);
      }

      // 2) ถ้า bulk ล้ม → ยิงทีละแถว
      if (!bulkOk) {
        for (const e of entries) {
          const hours = computeHoursAllowOverMidnight(e.work_date, e.start_time, e.end_time);
          await api.post("/timesheet", {
            task_id: e.task_id,
            hours,
            notes: e.note || "",
          });
        }
      }

      // 3) รีโหลด Task + Logs
      const tRes = await api.get(`/tasks/${task.id}`);
      setTask(tRes.data?.data || task);
      await reloadLogs(task.id);

      setMsg("บันทึกสำเร็จ");
      setRows([{ work_date: "", start_time: "", end_time: "", detail: "" }]);
    } catch (e) {
      console.error("SAVE ERR:", e?.response?.status, e?.response?.data || e.message);
      const m = e?.response?.data?.error || e?.response?.data?.message || e.message || "บันทึกไม่สำเร็จ";
      if (e?.response?.status === 401 && /expired/i.test(m)) {
        setErr("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      } else {
        setErr(m);
      }
    } finally {
      setSaving(false);
    }
  }

  async function markComplete() {
    if (!task) return;
    try {
      await api.post(`/timesheet/tasks/${task.id}/complete`);
      const res = await api.get(`/tasks/${task.id}`);
      setTask(res.data?.data || task);
      setMsg("ปิดงานสำเร็จ");
    } catch (e) {
      setErr(e?.response?.data?.error || "ปิดงานไม่สำเร็จ");
    }
  }

  // helper: คำนวณชั่วโมงแบบรองรับข้ามเที่ยงคืน
  function computeHoursAllowOverMidnight(workDate, startHHMM, endHHMM) {
    const toDate = (d, t) => new Date(`${d}T${t}:00`);
    let start = toDate(workDate, startHHMM);
    let end = toDate(workDate, endHHMM);
    if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    const secs = (end - start) / 1000;
    if (secs < 5 * 60) throw new Error("ช่วงเวลาสั้นเกินไป (<5 นาที)");
    if (secs > 16 * 3600) throw new Error("ช่วงเวลายาวเกินไป (>16 ชั่วโมง)");
    return Math.round((secs / 3600) * 100) / 100;
  }

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header - ปรับให้เหมือน Assign */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Timesheet
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              บันทึกเวลาทำงานของงานนี้ • {task ? `งาน: ${task.title}` : "กำลังโหลด…"}
            </p>
          </div>
        </header>

        {loading ? (
          <div className="text-gray-500">กำลังโหลดงาน...</div>
        ) : (
          <>
            {err && <div className="alert-error">{err}</div>}
            {msg && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {msg}
              </div>
            )}

            {task && (
              <div className="card">
                <div className="card-header">
                  <div className="card-dot" />
                  <h2 className="card-title">ข้อมูลงาน</h2>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">รหัสงาน</div>
                    <div className="text-lg font-medium mb-2">{task.task_code || `TS-${String(task.id).padStart(4, "0")}`}</div>
                    <div className="text-sm text-gray-600">
                      สถานะ: <span className="font-medium">{statusLabel(task.status)}</span> ·{" "}
                      กำหนดส่ง: <span className="font-medium">{task.due_date || "-"}</span>
                    </div>
                  </div>

                  {/* ปุ่มปิดงาน */}
                  {task.status !== "Complete" && (
                    <button
                      onClick={markComplete}
                      className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700"
                    >
                      ปิดงาน (Complete)
                    </button>
                  )}
                </div>
              </div>
            )}

            {problems.length > 0 && (
              <div className="alert-error">
                {problems.map((p, i) => (
                  <div key={i}>• {p}</div>
                ))}
              </div>
            )}

            {/* ฟอร์มเพิ่มรายการ */}
            <section className="card">
              <div className="card-header">
                <div className="card-dot" />
                <h2 className="card-title">เพิ่มรายการบันทึกเวลา</h2>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); saveAll(); }} className="space-y-4">
                {rows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-3 rounded-2xl border p-4 md:grid-cols-12 bg-gray-50">
                    <div className="md:col-span-3">
                      <label className="form-label">วันที่ทำงาน</label>
                      <input
                        type="date"
                        className="form-input"
                        value={row.work_date}
                        onChange={(e) => updateRow(idx, "work_date", e.target.value)}
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="form-label">เวลาเริ่ม</label>
                      <input
                        type="time"
                        className="form-input"
                        value={row.start_time}
                        onChange={(e) => updateRow(idx, "start_time", e.target.value)}
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="form-label">เวลาสิ้นสุด</label>
                      <input
                        type="time"
                        className="form-input"
                        value={row.end_time}
                        onChange={(e) => updateRow(idx, "end_time", e.target.value)}
                        required
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="form-label">รายละเอียด</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="เช่น ทำหน้า UI ฟอร์ม, แก้บั๊ก"
                        value={row.detail}
                        onChange={(e) => updateRow(idx, "detail", e.target.value)}
                      />
                    </div>
                    <div className="flex items-end justify-end md:col-span-1">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="rounded-xl border px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        disabled={rows.length === 1}
                        title={rows.length === 1 ? "อย่างน้อยต้องมี 1 แถว" : "ลบแถวนี้"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex gap-3 justify-center pt-2">
                  <button
                    type="button"
                    onClick={addRow}
                    className="btn-secondary inline-flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" /> เพิ่มแถว
                  </button>

                  <button
                    type="submit"
                    disabled={saving || loading || problems.length > 0 || !task}
                    className="bg-blue-600 text-white rounded px-4 py-2 text-sm inline-flex items-center justify-center hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                </div>
              </form>
            </section>

            {/* รายการที่บันทึกไว้แล้ว */}
            <section className="card-table">
              <div className="card-table-head">
                <h3 className="card-table-title">รายการที่บันทึกไว้</h3>
                <span className="card-table-meta">แสดง {logs.length} รายการ</span>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th">วันที่</th>
                      <th className="th">เริ่ม</th>
                      <th className="th">สิ้นสุด</th>
                      <th className="th">ชั่วโมง</th>
                      <th className="th">รายละเอียด</th>
                      <th className="th">บันทึกเมื่อ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">ยังไม่มีการบันทึก</td></tr>
                    ) : logs.map(x => (
                      <tr key={x.id}>
                        <td className="td">{x.work_date || "-"}</td>
                        <td className="td">{x.start_time || "-"}</td>
                        <td className="td">{x.end_time || "-"}</td>
                        <td className="td">{x.hours}</td>
                        <td className="td">{x.notes || "-"}</td>
                        <td className="td">{x.created_at?.slice(0, 16).replace("T", " ") || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}