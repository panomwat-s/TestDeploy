from flask import Blueprint, request, jsonify, g
from sqlalchemy import text
from app import db

# ถ้ามีตัวตรวจ token ใช้ของคุณเองได้เลย เช่น @auth_required
# เปลี่ยนตามโปรเจกต์คุณ:
def auth_required(fn):
    # ถ้าคุณมี decorator อยู่แล้วให้ลบทิ้งบล็อกนี้ และ import ของจริงมาใช้
    def wrapper(*args, **kwargs):
        # สมมติว่ามี g.current_user แล้วในโปรเจกต์จริง
        return fn(*args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.get("/summary")
@auth_required
def get_summary():
    # scope=mine (งานของฉัน), scope=all (ทั้งระบบสำหรับ Admin/HR)
    scope = (request.args.get("scope") or "mine").lower()

    # แก้ให้เข้ากับโปรเจกต์จริงของคุณ:
    user_id = getattr(getattr(g, "current_user", None), "id", None)
    user_role = getattr(getattr(g, "current_user", None), "role", "User")

    if scope != "all" or user_role == "User":
        sql = text("""
            SELECT
              SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END)::int AS in_progress,
              SUM(CASE WHEN status = 'Done'        THEN 1 ELSE 0 END)::int AS done
            FROM tasks
            WHERE assignee_id = :uid
        """)
        row = db.session.execute(sql, {"uid": user_id}).first()
    else:
        sql = text("""
            SELECT
              SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END)::int AS in_progress,
              SUM(CASE WHEN status = 'Done'        THEN 1 ELSE 0 END)::int AS done
            FROM tasks
        """)
        row = db.session.execute(sql).first()

    data = {
        "tasks": {
            "in_progress": (row.in_progress or 0) if row else 0,
            "done": (row.done or 0) if row else 0,
        }
    }
    return jsonify({"data": data})
