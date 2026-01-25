from flask import Blueprint, request, jsonify, g
from app import db, bcrypt
from app.models import User
from sqlalchemy import func
from app.utils.authz import jwt_required, require_roles
import jwt, datetime


auth_bp = Blueprint("auth", __name__)
# create_app: app.register_blueprint(auth_bp, url_prefix="/api/auth")

ALLOWED_ROLES = {"Admin", "HR", "User"}
ISSUER = "crm-timesheet"

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

def token_ttl_seconds():
    return int(current_app.config.get("JWT_ACCESS_TTL", 2 * 60 * 60))

@auth_bp.post("/register")
def register():
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 415

    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    email    = (data.get("email") or "").strip().lower()        # ⬅️ บังคับต้องมี
    password = data.get("password") or ""
    role     = (data.get("role") or "User").strip()

    # validate
    if not username or not email or not password:
        return jsonify({"error": "email, username and password are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "password must be at least 6 characters"}), 400
    if role not in ALLOWED_ROLES:
        return jsonify({"error": f"role must be one of {sorted(ALLOWED_ROLES)}"}), 400

    # duplicate checks
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "username already exists"}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "email already exists"}), 409

    try:
        hashed_pw = bcrypt.generate_password_hash(password).decode("utf-8")
        user = User(username=username, email=email, role=role, password_hash=hashed_pw)
        db.session.add(user)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "username or email already exists"}), 409

    return jsonify({"message": "User registered"}), 201


from flask import request, jsonify, current_app
from sqlalchemy import func
import datetime, jwt

@auth_bp.post("/login")
def login():
    # รับได้ทั้ง JSON และ form-urlencoded
    data = request.get_json(silent=True) or request.form or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    # ค้นหาแบบ case-insensitive
    user = User.query.filter(func.lower(User.email) == email).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401

    now = utcnow()
    payload = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "iat": int(now.timestamp()),
        "exp": int((now + datetime.timedelta(seconds=token_ttl_seconds())).timestamp()),
        "iss": ISSUER,
    }
    token = jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")
    return jsonify({
        "token": token,
        "token_type": "Bearer",
        "expires_in": token_ttl_seconds(),
        "user": {"id": user.id, "username": user.username, "email": user.email, "role": user.role}
    }), 200


@auth_bp.get("/me")
def me():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401

    token = auth.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(
            token,
            current_app.config["SECRET_KEY"],
            algorithms=["HS256"],
            options={"require": ["exp", "iat", "iss"]},
            issuer=ISSUER,
        )
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401

    return jsonify({"user": payload}), 200

@auth_bp.post("/change-password")
@jwt_required
def change_password():
    data = request.get_json()

    old_password = data.get("old_password")
    new_password = data.get("new_password")

    if not old_password or not new_password:
        return jsonify({"error": "missing password"}), 400

    user = User.query.get(g.user["id"])

    if not bcrypt.check_password_hash(
        user.password_hash, old_password
    ):
        return jsonify({"error": "old password incorrect"}), 400

    user.password_hash = bcrypt.generate_password_hash(new_password).decode()
    user.is_temp_password = False
    db.session.commit()

    return jsonify({"message": "password changed"})
