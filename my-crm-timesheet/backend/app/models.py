from app import db
from sqlalchemy import func

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, index=True, nullable=False)
    email = db.Column(db.String(255), unique=True, index=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="user")
    created_at = db.Column(db.DateTime, server_default=func.now())
    is_temp_password = db.Column(db.Boolean, default=True)
    is_active = db.Column(db.Boolean, default=True)

    

class Task(db.Model):
    __tablename__ = "tasks"
    id          = db.Column(db.Integer, primary_key=True)
    task_code   = db.Column(db.String(32), unique=True, index=True)
    title       = db.Column(db.String(200), nullable=False)
    assignee_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    due_date    = db.Column(db.Date, nullable=True)
    priority    = db.Column(db.String(20), nullable=False, default="Medium")
    # ⬇️ เปลี่ยนบรรทัดนี้ให้มี server_default + index
    status      = db.Column(db.String(20), nullable=False, server_default='Open', index=True)
    details     = db.Column(db.Text)
    created_by  = db.Column(db.String(100))
    created_at  = db.Column(db.DateTime, server_default=func.now(), nullable=False)
    updated_at  = db.Column(db.DateTime, onupdate=func.now())

    
    def to_dict(self, assignee_name=None):
        return {
            "id": self.id,
            "task_code": self.task_code,
            "title": self.title,
            "assignee_id": self.assignee_id,
            "assignee_name": assignee_name,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "priority": self.priority,
            "status": self.status,
            "details": self.details,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

# app/models.py
class Timesheet(db.Model):
    __tablename__ = "timesheets"
    id        = db.Column(db.Integer, primary_key=True)
    user_id   = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    task_id   = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=True)
    work_date = db.Column(db.Date, nullable=True)       # ✅ เพิ่ม
    start_time= db.Column(db.Time, nullable=True)       # ✅ เพิ่ม
    end_time  = db.Column(db.Time, nullable=True)       # ✅ เพิ่ม
    hours     = db.Column(db.Float, nullable=False)
    notes     = db.Column(db.Text)
    created_at= db.Column(db.DateTime, server_default=func.now())
