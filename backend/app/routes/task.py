from flask import Blueprint, request, jsonify
from sqlalchemy import or_, desc, asc
from datetime import date
from app import db
from app.models import Task, User

try:
    from flask_jwt_extended import jwt_required, get_jwt_identity
except Exception:
    def jwt_required(fn=None, **kwargs):
        def wrapper(f): return f
        return wrapper if fn is None else fn
    def get_jwt_identity(): return None

task_bp = Blueprint("tasks", __name__)

ALLOWED_STATUSES = {"Open", "In Progress", "Complete", "Cancelled"}

def _parse_date(s: str):
    return date.fromisoformat(s) if s else None

@task_bp.route("/", methods=["GET"])
@jwt_required(optional=True)
def list_tasks():
    search    = request.args.get("search", "").strip()
    priority  = request.args.get("priority")
    status    = request.args.get("status")
    page      = int(request.args.get("page", 1))
    page_size = min(int(request.args.get("page_size", 20)), 100)
    sort      = request.args.get("sort", "-created_at")

    q = db.session.query(Task, User.username.label("assignee_name")).join(User, User.id == Task.assignee_id)

    if search:
        s = f"%{search}%"
        q = q.filter(or_(Task.title.ilike(s), Task.details.ilike(s), Task.task_code.ilike(s), User.username.ilike(s)))
    if priority:
        q = q.filter(Task.priority == priority)
    if status:
        q = q.filter(Task.status == status)

    sort_field = sort.lstrip("-"); is_desc = sort.startswith("-")
    if hasattr(Task, sort_field):
        col = getattr(Task, sort_field)
        q = q.order_by(desc(col) if is_desc else asc(col))
    else:
        q = q.order_by(Task.created_at.desc())

    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    data = [t.to_dict(assignee_name=name) for (t, name) in items]
    return jsonify({"data": data, "page": page, "page_size": page_size, "total": total}), 200

@task_bp.route("/", methods=["POST"])
@jwt_required()
def create_task():
    data = request.get_json(force=True, silent=True) or {}
    title = (data.get("title") or "").strip()
    assignee_id = data.get("assignee_id")
    if not title or not assignee_id:
        return jsonify({"error": "title และ assignee_id ต้องมี"}), 400

    u = User.query.get(assignee_id)
    if not u:
        return jsonify({"error": "assignee_id ไม่พบผู้ใช้"}), 404

    jwt_user = get_jwt_identity() or {}
    created_by = jwt_user.get("username") if isinstance(jwt_user, dict) else None

    status = data.get("status", "Open")
    if status not in ALLOWED_STATUSES:
        return jsonify({"error": f"status must be one of {sorted(ALLOWED_STATUSES)}"}), 400

    t = Task(
        title=title,
        assignee_id=assignee_id,
        due_date=_parse_date(data.get("due_date")),
        priority=data.get("priority", "Medium"),
        status=status,
        details=data.get("details"),
        created_by=created_by,
    )

    if not data.get("task_code"):
        next_num = (db.session.query(db.func.coalesce(db.func.max(Task.id), 0)).scalar() or 0) + 1
        t.task_code = f"TS-{next_num:04d}"
    else:
        t.task_code = data["task_code"]

    db.session.add(t); db.session.commit()
    return jsonify(t.to_dict(assignee_name=u.username)), 201

@task_bp.route("/<int:task_id>", methods=["PUT", "PATCH"])
@jwt_required()
def update_task(task_id):
    t = Task.query.get_or_404(task_id)
    data = request.get_json(force=True, silent=True) or {}

    if "title" in data: t.title = (data["title"] or "").strip()
    if "priority" in data: t.priority = data["priority"]
    if "status" in data:
        new_status = data["status"]
        if new_status not in ALLOWED_STATUSES:
            return jsonify({"error": f"status must be one of {sorted(ALLOWED_STATUSES)}"}), 400
        t.status = new_status
    if "details" in data: t.details = data["details"]
    if "due_date" in data: t.due_date = _parse_date(data["due_date"])
    if "assignee_id" in data:
        u = User.query.get(data["assignee_id"])
        if not u: return jsonify({"error": "assignee_id ไม่พบผู้ใช้"}), 404
        t.assignee_id = u.id

    db.session.commit()
    u = User.query.get(t.assignee_id)
    return jsonify(t.to_dict(assignee_name=u.username if u else None)), 200

@task_bp.route("/<int:task_id>", methods=["GET"])
@jwt_required()
def get_task(task_id):
    t, name = db.session.query(Task, User.username).join(User, User.id == Task.assignee_id).filter(Task.id == task_id).first_or_404()
    return jsonify(t.to_dict(assignee_name=name)), 200

@task_bp.route("/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete_task(task_id):
    t = Task.query.get_or_404(task_id)
    db.session.delete(t); db.session.commit()
    return jsonify({"ok": True}), 200

@task_bp.patch("/<int:task_id>/assign")
@jwt_required()
def assign_task(task_id):
    data = request.get_json()
    assignee_id = data.get("assignee_id")

    if not assignee_id:
        return jsonify({"error": "assignee_id required"}), 400

    task = Task.query.get_or_404(task_id)
    user = User.query.get_or_404(assignee_id)

    task.assignee_id = user.id
    db.session.commit()

    return jsonify({
        "message": "assigned",
        "assignee_name": user.username
    })
