import os

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:0942701542az@localhost:5432/crm_timesheet_db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
