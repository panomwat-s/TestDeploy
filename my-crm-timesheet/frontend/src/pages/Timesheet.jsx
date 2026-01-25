// src/pages/Timesheet.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import { Plus, Trash2, Calendar, Clock3, Save } from "lucide-react";

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
        const res = await api.get(`/tasks${taskId}`);
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
      setTask(res.data?.data || task);  // รีเฟรชสถานะ
      setMsg("ปิดงานสำเร็จ");
    } catch (e) {
      setErr(e?.response?.data?.error || "ปิดงานไม่สำเร็จ");
    }
  }

  // helper: คำนวณชั่วโมงแบบรองรับข้ามเที่ยงคืน
  function computeHoursAllowOverMidnight(workDate, startHHMM, endHHMM) {
    const toDate = (d, t) => new Date(`${d}T${t}:00`);
    let start = toDate(workDate, startHHMM);
    let end   = toDate(workDate, endHHMM);
    if (end <= start) end = new Date(end.getTime() + 24*60*60*1000);
    const secs = (end - start) / 1000;
    if (secs < 5*60)  throw new Error("ช่วงเวลาสั้นเกินไป (<5 นาที)");
    if (secs > 16*3600) throw new Error("ช่วงเวลายาวเกินไป (>16 ชั่วโมง)");
    return Math.round((secs / 3600) * 100) / 100;
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Timesheet</h1>
        <p className="text-sm text-gray-500">บันทึกเวลาทำงานของงานนี้ แล้วกลับไปดูสรุปที่ Dashboard</p>
      </div>

      {loading ? (
        <div className="text-gray-500">กำลังโหลดงาน...</div>
      ) : (
        <>
          {err && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          )}
          {msg && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {msg}
            </div>
          )}

          {task && (
            <div className="mb-6 rounded-2xl border p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Task</div>
                <div className="text-lg font-medium">{task.title}</div>
                <div className="text-sm text-gray-600">
                  Status: <span className="font-medium">{task.status}</span> ·{" "}
                  Due: <span className="font-medium">{task.due_date || "-"}</span>
                </div>
              </div>

              {/* ปุ่มปิดงาน */}
              {task.status !== "Complete" && (
                <button
                  onClick={markComplete}
                  className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
                >
                  ปิดงาน (Complete)
                </button>
              )}
            </div>
          )}

          {problems.length > 0 && (
            <div className="mb-4 rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
              {problems.map((p, i) => (
                <div key={i}>• {p}</div>
              ))}
            </div>
          )}

          {/* ฟอร์มเพิ่มรายการ */}
          <form
            onSubmit={(e) => { e.preventDefault(); saveAll(); }}
            className="space-y-4"
          >
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-3 rounded-2xl border p-4 md:grid-cols-12">
                <div className="md:col-span-3">
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4" /> วันที่ทำงาน
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-xl border px-3 py-2"
                    value={row.work_date}
                    onChange={(e) => updateRow(idx, "work_date", e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                    <Clock3 className="h-4 w-4" /> เวลาเริ่ม
                  </label>
                  <input
                    type="time"
                    className="w-full rounded-xl border px-3 py-2"
                    value={row.start_time}
                    onChange={(e) => updateRow(idx, "start_time", e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                    <Clock3 className="h-4 w-4" /> เวลาสิ้นสุด
                  </label>
                  <input
                    type="time"
                    className="w-full rounded-xl border px-3 py-2"
                    value={row.end_time}
                    onChange={(e) => updateRow(idx, "end_time", e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="mb-1 text-sm font-medium">รายละเอียด</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border px-3 py-2"
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

            <div className="flex gap-3">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" /> เพิ่มแถว
              </button>

              <button
                type="submit"
                disabled={saving || loading || problems.length > 0 || !task}
                className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 font-medium text-white disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>

          {/* รายการที่บันทึกไว้แล้ว */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-3">รายการที่บันทึกไว้</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border rounded-xl overflow-hidden">
                <thead className="bg-gray-50 text-sm">
                  <tr>
                    <th className="px-3 py-2 text-left">วันที่</th>
                    <th className="px-3 py-2 text-left">เริ่ม</th>
                    <th className="px-3 py-2 text-left">สิ้นสุด</th>
                    <th className="px-3 py-2 text-left">ชั่วโมง</th>
                    <th className="px-3 py-2 text-left">รายละเอียด</th>
                    <th className="px-3 py-2 text-left">บันทึกเมื่อ</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {logs.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-4 text-gray-500 text-center">ยังไม่มีการบันทึก</td></tr>
                  ) : logs.map(x => (
                    <tr key={x.id} className="border-t">
                      <td className="px-3 py-2">{x.work_date || "-"}</td>
                      <td className="px-3 py-2">{x.start_time || "-"}</td>
                      <td className="px-3 py-2">{x.end_time || "-"}</td>
                      <td className="px-3 py-2">{x.hours}</td>
                      <td className="px-3 py-2">{x.notes || "-"}</td>
                      <td className="px-3 py-2">{x.created_at?.slice(0, 16).replace("T", " ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
