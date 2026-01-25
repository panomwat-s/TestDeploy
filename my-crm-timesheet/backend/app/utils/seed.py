from app import db, bcrypt
from app.models import User

def seed_admin():
    existing = User.query.filter_by(email="admin@example.com").first()
    if existing:
        print("✅ Admin already exists, skip seeding")
        return

    admin = User(
        username="admin",
        email="admin@example.com",
        password_hash=bcrypt.generate_password_hash("admin123").decode("utf-8"),
        role="Admin",
        is_temp_password=True
    )

    db.session.add(admin)
    db.session.commit()
    print("✅ Admin seeded")
