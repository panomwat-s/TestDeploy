from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_migrate import Migrate
from app.config import Config

db = SQLAlchemy()
bcrypt = Bcrypt()
migrate = Migrate()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app)
    db.init_app(app)
    bcrypt.init_app(app)
    migrate.init_app(app, db)

    # ต้องอยู่ใน app_context เท่านั้น
    with app.app_context():
        from app import models
        db.create_all()

        from app.seed import seed_admin
        seed_admin()

    # register routes
    from app.routes.auth import auth_bp
    from app.routes.task import task_bp
    from app.routes.timesheet import timesheet_bp
    from app.routes.users import users_bp
    from app.routes.dashboard import dashboard_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(task_bp, url_prefix="/api/tasks")
    app.register_blueprint(timesheet_bp, url_prefix="/api/timesheet")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")

    return app
