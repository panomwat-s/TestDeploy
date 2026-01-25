from flask import Blueprint, request, jsonify, g
from app import db
from app.models import Timesheet, Task
from app.utils.authz import require_roles
from datetime import datetime, date, time, timedelta
from sqlalchemy import text

timesheet_bp = Blueprint("timesheet", __name__)
# ใน create_app: app.register_blueprint(timesheet_bp, url_prefix="/api/timesheet")

# ---------- helpers ----------
def ensure_json():
    if not request.is_json:
        return None, jsonify({"error": "Content-Type must be application/json"}), 415
    data = request.get_json(silent=True)
    if data is None:
        return None, jsonify({"error": "Invalid JSON body"}), 400
    return data, None, None

def parse_date_ymd(s):
    try: return datetime.strptime(s, "%Y-%m-%d").date() if s else None
    except ValueError: return None

def parse_hhmm(s):
    return datetime.strptime(s, "%H:%M").time()

def minutes_between(d: date, t1: time, t2: time) -> int:
    return max(0, int((datetime.combine(d,t2) - datetime.combine(d,t1)).total_seconds() // 60))

def ts_to_dict(t: Timesheet):
    return {
        "id": t.id,
        "user_id": t.user_id,
        "task_id": t.task_id,
        "work_date": t.work_date.isoformat() if t.work_date else None,
        "start_time": t.start_time.isoformat() if t.start_time else None,
        "end_time": t.end_time.isoformat() if t.end_time else None,
        "hours": t.hours,
        "notes": t.notes,
        "created_at": t.created_at.isoformat() if getattr(t, "created_at", None) else None,
    }

def _update_tasks_to_in_progress(task_ids):
    ids = list({int(i) for i in (task_ids or [])})
    if not ids: return
    db.session.execute(
        text("UPDATE tasks SET status = 'In Progress' WHERE id = ANY(:ids) AND status = 'Open'"),
        {"ids": ids}
    )
    db.session.commit()

# ---------- routes ----------
@timesheet_bp.get("/")
@require_roles("Admin", "HR", "User")
def get_timesheets():
    # filter: task_id, user_id(Admin/HR), from, to, paging
    q = Timesheet.query
    role = g.user.get("role"); user_id = g.user.get("id")

    param_user = request.args.get("user_id", type=int)
    if role in {"Admin","HR"} and param_user:
        q = q.filter(Timesheet.user_id == param_user)
    else:
        q = q.filter(Timesheet.user_id == user_id)

    task_id = request.args.get("task_id", type=int)
    if task_id:
        q = q.filter(Timesheet.task_id == task_id)

    d_from = parse_date_ymd(request.args.get("from"))
    d_to   = parse_date_ymd(request.args.get("to"))
    if request.args.get("from") and not d_from:
        return jsonify({"error":"from must be YYYY-MM-DD"}), 400
    if request.args.get("to") and not d_to:
        return jsonify({"error":"to must be YYYY-MM-DD"}), 400
    if d_from: q = q.filter(Timesheet.work_date >= d_from)
    if d_to:   q = q.filter(Timesheet.work_date <= d_to)

    page = request.args.get("page", 1, type=int)
    size = min(max(request.args.get("page_size", 20, type=int),1),100)

    total = q.count()
    items = (q.order_by(Timesheet.work_date.desc(), Timesheet.start_time.asc(), Timesheet.id.desc())
               .offset((page-1)*size).limit(size).all())
    return jsonify({"items":[ts_to_dict(t) for t in items], "page":page, "page_size":size, "total":total}), 200

# app/routes/timesheet.py (เฉพาะสอง endpoint นี้)

@timesheet_bp.post("/bulk")
@require_roles("Admin", "HR", "User")
def bulk_create_timesheets():
    data, err_resp, err_status = ensure_json()
    if err_resp: return err_resp, err_status

    entries = data.get("entries") or data.get("data") or data.get("rows")
    if not isinstance(entries, list) or not entries:
        return jsonify({"error": "entries (list) is required"}), 400

    from datetime import datetime, timedelta

    def parse_time_flex(s: str):
        if not s: raise ValueError("time is required")
        s = s.strip()
        for fmt in ("%H:%M", "%I:%M %p", "%H:%M:%S"):
            try: return datetime.strptime(s, fmt).time()
            except ValueError:
                pass
        raise ValueError("time must be HH:MM or hh:mm AM/PM")

    def compute_hours(d_str, s_str, e_str):
        d  = datetime.strptime(d_str, "%Y-%m-%d").date()
        s  = parse_time_flex(s_str)
        ed = parse_time_flex(e_str)
        start_dt = datetime.combine(d, s)
        end_dt   = datetime.combine(d, ed)
        if end_dt <= start_dt:
            end_dt += timedelta(days=1)
        secs = (end_dt - start_dt).total_seconds()
        if secs < 5*60:  raise ValueError("duration too short (<5min)")
        if secs > 16*3600: raise ValueError("duration too long (>16h)")
        return round(secs/3600.0, 2)

    uid = g.user["id"]
    created, touched, errors = [], [], []

    for i, e in enumerate(entries, 1):
        try:
            tid = int(e["task_id"])
            hours = None

            if all(k in e and e[k] for k in ("work_date","start_time","end_time")):
                hours = compute_hours(e["work_date"], e["start_time"], e["end_time"])
            elif "hours" in e:
                hours = float(e["hours"])
                if hours <= 0: raise ValueError("hours must be > 0")
            else:
                raise ValueError("missing hours or (work_date,start_time,end_time)")

            ts = Timesheet(
                user_id=uid, task_id=tid, hours=hours,
                notes=(e.get("note") or e.get("notes") or "").strip()
            )
            db.session.add(ts)
            created.append(ts)
            touched.append(tid)
        except Exception as ex:
            errors.append(f"row {i}: {ex}")

    # ถ้ามีสักแถวที่ valid ก็ commit (กัน 500)
    if created:
        db.session.commit()
        # อัปเดต Open -> In Progress
        from sqlalchemy import text
        db.session.execute(
            text("UPDATE tasks SET status='In Progress' WHERE status='Open' AND id = ANY(:ids)"),
            {"ids": list(set(touched))}
        )
        db.session.commit()

    if errors and not created:
        return jsonify({"error": "; ".join(errors)}), 400

    return jsonify({"saved": len(created), "errors": errors}), 201


@timesheet_bp.post("/")
@require_roles("Admin", "HR", "User")
def create_timesheet():
    data, err_resp, err_status = ensure_json()
    if err_resp: return err_resp, err_status

    user_id = g.user["id"]
    task_id = data.get("task_id")
    if not task_id:
        return jsonify({"error": "task_id is required"}), 400

    # รูปแบบยืดหยุ่นเหมือน bulk
    hours = None
    if all(k in data and data[k] for k in ("work_date","start_time","end_time")):
        from datetime import datetime
        try:
            d  = datetime.strptime(data["work_date"], "%Y-%m-%d").date()
            s  = datetime.strptime(data["start_time"], "%H:%M").time()
            ed = datetime.strptime(data["end_time"], "%H:%M").time()
        except ValueError:
            return jsonify({"error":"invalid time/date format"}), 400
        if ed <= s: return jsonify({"error":"end_time must be after start_time"}), 400
        mins = int((datetime.combine(d, ed) - datetime.combine(d, s)).total_seconds() // 60)
        hours = round(mins / 60.0, 2)
    elif "hours" in data:
        try:
            hours = float(data["hours"])
        except Exception:
            return jsonify({"error":"hours must be a number"}), 400
        if hours <= 0:
            return jsonify({"error":"hours must be > 0"}), 400
    else:
        return jsonify({"error":"hours or (work_date+start_time+end_time) is required"}), 400

    ts = Timesheet(user_id=user_id, task_id=task_id, hours=hours, notes=(data.get("notes") or "").strip())
    db.session.add(ts); db.session.commit()

    # อัปเดตสถานะ Task
    from sqlalchemy import text
    db.session.execute(
        text("UPDATE tasks SET status='In Progress' WHERE status='Open' AND id=:tid"),
        {"tid": int(task_id)}
    )
    db.session.commit()

    return jsonify(ts_to_dict(ts)), 201


@timesheet_bp.put("/<int:ts_id>")
@require_roles("Admin", "HR", "User")
def update_timesheet(ts_id):
    ts = Timesheet.query.get_or_404(ts_id)
    role = g.user.get("role"); requester_id = g.user.get("id")
    if role not in {"Admin","HR"} and ts.user_id != requester_id:
        return jsonify({"error":"Forbidden"}), 403

    data, err_resp, err_status = ensure_json()
    if err_resp: return err_resp, err_status

    if "notes" in data: ts.notes = (data.get("notes") or data.get("note") or "").strip()
    if "task_id" in data:
        try: ts.task_id = int(data["task_id"])
        except (TypeError, ValueError): return jsonify({"error":"task_id must be int"}), 400

    if all(k in data for k in ("work_date","start_time","end_time")):
        d = parse_date_ymd(data["work_date"])
        if not d: return jsonify({"error":"work_date must be YYYY-MM-DD"}), 400
        s = parse_hhmm(data["start_time"]); ed = parse_hhmm(data["end_time"])
        if ed <= s: return jsonify({"error":"end_time must be after start_time"}), 400
        ts.work_date, ts.start_time, ts.end_time = d, s, ed
        ts.hours = round(minutes_between(d,s,ed)/60.0, 2)
    elif "hours" in data:
        try:
            val = float(data["hours"])
        except (TypeError, ValueError):
            return jsonify({"error":"hours must be a number"}), 400
        if val <= 0: return jsonify({"error":"hours must be > 0"}), 400
        ts.hours = val

    db.session.commit()
    return jsonify(ts_to_dict(ts)), 200

@timesheet_bp.delete("/<int:ts_id>")
@require_roles("Admin", "HR", "User")
def delete_timesheet(ts_id):
    ts = Timesheet.query.get_or_404(ts_id)
    role = g.user.get("role"); requester_id = g.user.get("id")
    if role not in {"Admin","HR"} and ts.user_id != requester_id:
        return jsonify({"error":"Forbidden"}), 403
    db.session.delete(ts); db.session.commit()
    return "", 204

# ====== Task status helpers/endpoint (สำหรับปุ่มปิดงาน) ======

def _set_task_status(task_id: int, new_status: str):
    """อัปเดตสถานะ Task แบบปลอดภัยและ commit ในที่เดียว"""
    allowed = {"Open", "In Progress", "Complete", "Closed"}
    if new_status not in allowed:
        return False, f"Invalid status '{new_status}'"

    # ใช้ text() ป้องกัน SQL injection และทำงานเร็ว
    res = db.session.execute(
        text("UPDATE tasks SET status = :st WHERE id = :tid"),
        {"st": new_status, "tid": int(task_id)}
    )
    db.session.commit()
    # res.rowcount อาจเป็น 0 ถ้าไม่พบ task_id
    if getattr(res, "rowcount", 0) == 0:
        return False, "Task not found"
    return True, None


@timesheet_bp.post("/tasks/<int:task_id>/complete")
@require_roles("Admin", "HR", "User")
def mark_task_complete(task_id):
    """
    ปิดงาน: ตั้ง status = 'Complete'
    ใช้จากปุ่ม 'ปิดงาน (Complete)' บนหน้า Timesheet
    """
    ok, err = _set_task_status(task_id, "Complete")
    if not ok:
        return jsonify({"error": err}), 404 if err == "Task not found" else 400
    return jsonify({"ok": True, "task_id": task_id, "status": "Complete"}), 200


@timesheet_bp.post("/tasks/<int:task_id>/reopen")
@require_roles("Admin", "HR")
def reopen_task(task_id):
    """
    (ตัวเลือก) เปิดงานใหม่: ตั้ง status = 'Open'
    เฉพาะ Admin/HR
    """
    ok, err = _set_task_status(task_id, "Open")
    if not ok:
        return jsonify({"error": err}), 404 if err == "Task not found" else 400
    return jsonify({"ok": True, "task_id": task_id, "status": "Open"}), 200
