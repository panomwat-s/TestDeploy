from functools import wraps
from flask import request, jsonify, current_app, g
import jwt


def require_roles(*roles):
    """
    ตรวจ Authorization: Bearer <token> + ตรวจ role (ถ้ามีระบุ)
    """
    def wrap(fn):
        @wraps(fn)
        def inner(*args, **kwargs):

            # ✅ allow CORS preflight
            if request.method == "OPTIONS":
                return "", 200

            auth = request.headers.get("Authorization", "")
            if not auth.startswith("Bearer "):
                return jsonify({"error": "Unauthorized"}), 401

            token = auth.split(" ", 1)[1].strip()
            try:
                payload = jwt.decode(
                    token,
                    current_app.config["SECRET_KEY"],
                    algorithms=["HS256"],
                    options={"require": ["exp"]}
                )
            except jwt.ExpiredSignatureError:
                return jsonify({"error": "Token expired"}), 401
            except jwt.InvalidTokenError:
                return jsonify({"error": "Invalid token"}), 401

            if roles and payload.get("role") not in roles:
                return jsonify({"error": "Forbidden"}), 403

            g.user = payload
            return fn(*args, **kwargs)
        return inner
    return wrap


def jwt_required(fn):
    @wraps(fn)
    def inner(*args, **kwargs):

        # ✅ allow CORS preflight
        if request.method == "OPTIONS":
            return "", 200

        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401

        token = auth.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(
                token,
                current_app.config["SECRET_KEY"],
                algorithms=["HS256"],
                options={"require": ["exp"]}
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        g.user = payload
        return fn(*args, **kwargs)
    return inner
