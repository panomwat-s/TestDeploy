// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { BarChart3, AlertTriangle, CheckCircle2, Clock, Plus } from "lucide-react";
import "../assign.css";

export default function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        // ใช้ page_size ให้ตรงกับ BE
        const res = await api.get("/tasks/", { params: { sort: "-created_at", page_size: 200 } });
        if (!mounted) return;
        setTasks(res.data?.data || []);
      } catch (e) {
        console.error(e);
        if (mounted) setError(e?.response?.data?.error || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ————— helpers —————
  const norm = (s) => (s || "open").toLowerCase().replace(/\s+/g, "_");

  const statusLabel = (s) => {
    switch (norm(s)) {
      case "open": return "Open";
      case "in_progress": return "In Progress";
      case "resolved": return "complete";
      case "complete": return "Complete";
      case "closed": return "closed";
      default: return s || "-";
    }
  };

  const statusBadgeClass = (s) => {
    switch (norm(s)) {
      case "in_progress": return "priority-badge priority-medium";
      case "resolved":    return "priority-badge priority-low";
      case "complete":    return "priority-badge priority-low";
      case "closed":      return "priority-badge priority-low";
      case "open":
      default:            return "priority-badge priority-medium";
    }
  };

  // KPI summary (รวม Complete เป็น “เสร็จสิ้น”)
  const kpis = useMemo(() => {
    const byStatus = tasks.reduce((acc, t) => {
      const k = norm(t.status);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const byPriority = tasks.reduce((acc, t) => {
      const k = t.priority || "Medium";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, { Low: 0, Medium: 0, High: 0 });

    return {
      total: tasks.length,
      inProgress: byStatus.in_progress || 0,
      done: (byStatus.complete || 0) + (byStatus.resolved || 0) + (byStatus.closed || 0),
      urgent: byPriority.High || 0,
    };
  }, [tasks]);

  // กราฟแท่งรายสัปดาห์จาก created_at
  const weeklyBars = useMemo(() => {
    const buckets = new Map();
    tasks.forEach(t => {
      if (!t.created_at) return;
      const dt = new Date(t.created_at);
      const y = dt.getFullYear();
      const start = new Date(y, 0, 1);
      const diffDays = Math.floor((dt - start) / 86400000);
      const week = String(Math.floor(diffDays / 7) + 1).padStart(2, "0");
      const key = `${y}-W${week}`;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    });
    const data = Array.from(buckets.entries()).sort(([a], [b]) => (a > b ? 1 : -1)).slice(-8);
    const max = Math.max(1, ...data.map(([, v]) => v));
    return { data, max };
  }, [tasks]);

  // distribution priority
  const priorityDist = useMemo(() => {
    const counts = { Low: 0, Medium: 0, High: 0 };
    tasks.forEach(t => { counts[t.priority || "Medium"]++; });
    const total = Math.max(1, Object.values(counts).reduce((a, b) => a + b, 0));
    const pct = Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, Math.round((v * 100) / total)])
    );
    return { counts, pct, total };
  }, [tasks]);

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="bg-white/60 backdrop-blur rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
            <button
              onClick={() => navigate("/assign")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white 
                     text-sm px-3 py-1.5 shadow hover:shadow-md transition disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5" /> เพิ่มงาน
            </button>
          </div>
        </header>

        {error && <div className="alert-error">{error}</div>}

        {/* KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="งานทั้งหมด" value={loading ? "…" : kpis.total} icon={<BarChart3 className="w-4 h-4" />} tone="from-indigo-500 to-violet-500" />
          <KpiCard title="ระหว่างดำเนินการ" value={loading ? "…" : kpis.inProgress} icon={<Clock className="w-4 h-4" />} tone="from-amber-500 to-orange-500" />
          <KpiCard title="เสร็จสิ้น" value={loading ? "…" : kpis.done} icon={<CheckCircle2 className="w-4 h-4" />} tone="from-emerald-500 to-teal-500" />
          <KpiCard title="เร่งด่วน" value={loading ? "…" : kpis.urgent} icon={<AlertTriangle className="w-4 h-4" />} tone="from-rose-500 to-pink-500" />
        </section>

        {/* Charts + Priority */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly Chart */}
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="card-title">สถิติงานที่สร้างรายสัปดาห์</h3>
              <span className="text-xs text-gray-500">ล่าสุด {weeklyBars.data?.length || 0} สัปดาห์</span>
            </div>
            <div className="h-56 w-full">
              {loading ? (
                <div className="w-full h-full animate-pulse bg-gray-50 rounded-xl" />
              ) : weeklyBars.data?.length ? (
                <svg viewBox="0 0 500 200" className="w-full h-full">
                  <defs>
                    <linearGradient id="bars" x1="0" x2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                  <line x1="30" y1="10" x2="30" y2="170" stroke="#e5e7eb" strokeWidth="1" />
                  <line x1="30" y1="170" x2="490" y2="170" stroke="#e5e7eb" strokeWidth="1" />
                  {weeklyBars.data.map(([label, value], idx) => {
                    const barW = 40, gap = 20;
                    const x = 40 + idx * (barW + gap);
                    const h = Math.round((value / weeklyBars.max) * 140);
                    const y = 170 - h;
                    return (
                      <g key={label}>
                        <rect x={x} y={y} width={40} height={h} rx="6" fill="url(#bars)" />
                        <text x={x + 20} y={185} textAnchor="middle" className="fill-gray-500 text-[10px]">
                          {label.slice(-3)}
                        </text>
                        <text x={x + 20} y={y - 6} textAnchor="middle" className="fill-gray-700 text-[11px]">
                          {value}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="h-full grid place-items-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              )}
            </div>
          </div>

          {/* Priority distribution */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="card-title">ระดับความสำคัญ</h3>
              <span className="text-xs text-gray-500">{priorityDist.total} งาน</span>
            </div>
            {["High", "Medium", "Low"].map((k) => (
              <div key={k} className="mb-4">
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="text-gray-700">{k === "High" ? "เร่งด่วน" : k === "Medium" ? "ปานกลาง" : "ต่ำ"}</span>
                  <span className="text-gray-500">{priorityDist.pct[k] || 0}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded">
                  <div
                    className={
                      "h-2 rounded " +
                      (k === "High" ? "bg-rose-400" : k === "Medium" ? "bg-amber-400" : "bg-emerald-400")
                    }
                    style={{ width: `${priorityDist.pct[k] || 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Latest table */}
        <section className="card-table">
          <div className="card-table-head">
            <h3 className="card-table-title">รายการงานล่าสุด</h3>
            <span className="card-table-meta">แสดง {Math.min(tasks.length, 10)} จาก {tasks.length}</span>
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
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">กำลังโหลด…</td></tr>
                ) : tasks.slice(0, 10).map((t) => (
                  <tr key={t.id}>
                    <td className="td">{t.task_code || `TS-${String(t.id).padStart(4, "0")}`}</td>
                    <td className="td font-medium text-gray-900">{t.title}</td>
                    <td className="td">{t.assignee_name || t.assignee?.name || "-"}</td>
                    <td className="td">
                      <span
                        className={
                          "priority-badge " +
                          (t.priority === "High"
                            ? "priority-high"
                            : t.priority === "Medium"
                              ? "priority-medium"
                              : "priority-low")
                        }
                      >
                        {t.priority || "-"}
                      </span>
                    </td>
                    <td className="td">
                      <span className={statusBadgeClass(t.status)}>
                        {statusLabel(t.status)}
                      </span>
                    </td>
                    <td className="td">{t.due_date ? ("" + t.due_date).slice(0, 10) : "-"}</td>
                  </tr>
                ))}
                {!loading && tasks.length === 0 && (
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

/* ============ small component for KPI ============ */
function KpiCard({ title, value, tone, icon }) {
  return (
    <div className="group relative overflow-hidden bg-white rounded-2xl shadow border border-gray-100 p-5">
      <div className={`absolute inset-x-0 -top-10 h-24 bg-gradient-to-r ${tone} opacity-25 blur-2xl transition-all group-hover:opacity-40`} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {icon}<span>{title}</span>
          </div>
          <div className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">{value}</div>
        </div>
      </div>
    </div>
  );
}
