# app/routes/users.py
from flask import Blueprint, request, jsonify
from app.models import User
from app import db, bcrypt
from app.utils.authz import require_roles, jwt_required
import random, string

users_bp = Blueprint("users", __name__)

# GET all users
@users_bp.get("/")
@jwt_required
@require_roles("admin")
def get_users():
    users = User.query.all()
    return jsonify([
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active
        } for u in users
    ])

# CREATE user
@users_bp.post("/")
@jwt_required
@require_roles("admin")
def create_user():
    data = request.get_json()
    password = ''.join(random.choices(string.ascii_letters + string.digits, k=8))

    user = User(
        username=data["username"],
        email=data["email"],
        role=data.get("role", "User"),
        password_hash=bcrypt.generate_password_hash(password).decode(),
        is_temp_password=True
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": "User created",
        "temp_password": password
    })

# RESET password
@users_bp.post("/<int:user_id>/reset")
@jwt_required
@require_roles("admin")
def reset_password(user_id):
    user = User.query.get_or_404(user_id)
    new_password = "welcome123"

    user.password_hash = bcrypt.generate_password_hash(new_password).decode()
    user.is_temp_password = True
    db.session.commit()

    return jsonify({"new_password": new_password})

# DISABLE user
@users_bp.post("/<int:user_id>/disable")
@jwt_required
@require_roles("admin")
def disable_user(user_id):
    user = User.query.get_or_404(user_id)
    user.is_active = False
    db.session.commit()
    return jsonify({"message": "disabled"})

@users_bp.patch("/<int:user_id>/enable")
@jwt_required
@require_roles("admin")
def enable_user(user_id):
    user = User.query.get_or_404(user_id)
    user.is_active = True
    db.session.commit()
    return jsonify({"message": "enabled"})

# DELETE user
@users_bp.delete("/<int:user_id>")
@jwt_required
@require_roles("admin")
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "deleted"})

@users_bp.get("/assignable")
@jwt_required
def assignable_users():
    users = User.query.filter_by(is_active=True).all()
    return jsonify([
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
        } for u in users
    ])

