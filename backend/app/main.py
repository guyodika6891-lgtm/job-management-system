import os

from fastapi import FastAPI
from sqlalchemy import text

from app.db.session import engine
from app.routers.auth import router as auth_router
from app.routers.jobs import router as jobs_router
from app.routers.applications import router as applications_router
from app.routers.notifications import router as notifications_router
from app.routers.saved_jobs import router as saved_jobs_router
from app.routers.search_alerts import router as search_alerts_router
from app.routers.application_messages import router as application_messages_router
from app.routers.interviews import router as interviews_router
from app.routers.admin import router as admin_router
from fastapi.middleware.cors import CORSMiddleware

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app = FastAPI(
    title="Job Management System API",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(applications_router)
app.include_router(notifications_router)
app.include_router(saved_jobs_router)
app.include_router(search_alerts_router)
app.include_router(application_messages_router)
app.include_router(interviews_router)
app.include_router(admin_router)

@app.get("/")
def root():
    return {
        "message": "Welcome to the Job Management System API"
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/health/db")
def database_health_check():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {
        "status": "healthy",
        "database": "connected",
    }