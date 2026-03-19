"""SynergyHub — FastAPI Application."""

import os
import hashlib
import hmac
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .config import settings
from .database import init as db_init, query
from .routes import tasks, customers, team, activities, shifts, bookings, demos, training, faq, helpdesk, onboarding, ask, google_auth, gmail, marketing, comms, platform_api


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and start background tasks on startup."""
    try:
        db_init()
    except Exception as e:
        print(f"Database init warning: {e}")
    # Start marketing automation engine
    try:
        from .scheduler import start as start_marketing_engine
        start_marketing_engine()
    except Exception as e:
        print(f"Marketing engine start warning: {e}")
    yield


app = FastAPI(lifespan=lifespan, title="SynergyHub API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(customers.router, prefix="/api/customers", tags=["customers"])
app.include_router(team.router, prefix="/api/team", tags=["team"])
app.include_router(activities.router, prefix="/api/activities", tags=["activities"])
app.include_router(shifts.router, prefix="/api/shifts", tags=["shifts"])
app.include_router(bookings.router, prefix="/api/bookings", tags=["bookings"])
app.include_router(demos.router, prefix="/api/demos", tags=["demos"])
app.include_router(training.router, prefix="/api/training", tags=["training"])
app.include_router(faq.router, prefix="/api/faq", tags=["faq"])
app.include_router(helpdesk.router, prefix="/api/helpdesk", tags=["helpdesk"])
app.include_router(onboarding.router, prefix="/api/onboarding", tags=["onboarding"])
app.include_router(ask.router, prefix="/api/ask", tags=["ask"])
app.include_router(google_auth.router, prefix="/api/google", tags=["google"])
app.include_router(gmail.router, prefix="/api/gmail", tags=["gmail"])
app.include_router(marketing.router, prefix="/api/marketing", tags=["marketing"])
app.include_router(comms.router, prefix="/api/comms", tags=["comms"])
app.include_router(platform_api.router, prefix="/api/platform", tags=["platform"])

# ── Auth ──

APP_PASSWORD = os.environ.get("APP_PASSWORD", "PD1234")

class AuthRequest(BaseModel):
    password: str

@app.post("/api/auth/verify")
def verify_password(req: AuthRequest):
    if hmac.compare_digest(req.password, APP_PASSWORD):
        return {"ok": True}
    return {"ok": False, "error": "Forkert adgangskode"}

# ── Diagnostics ──

@app.get("/api/db-tables")
def list_db_tables():
    """List all database tables (diagnostic)."""
    tables = query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
    return {"tables": [t["tablename"] for t in tables]}


@app.post("/api/shifts-reset-cancelled")
def reset_cancelled_shifts():
    """Delete all cancelled shifts so auto-seed can refill them."""
    from .database import execute as db_execute
    db_execute("DELETE FROM shifts WHERE status = 'cancelled'")
    return {"ok": True}

@app.post("/api/db-migrate")
def run_migration():
    """Re-run database init to create missing tables."""
    try:
        db_init()
        tables = query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
        return {"ok": True, "tables": [t["tablename"] for t in tables]}
    except Exception as e:
        return {"error": str(e)}


# Serve frontend — SPA-aware static file serving
dist_path = os.path.abspath(settings.frontend_dist)
if os.path.isdir(dist_path):
    # Mount /assets for hashed JS/CSS bundles and static assets
    assets_dir = os.path.join(dist_path, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # SPA catch-all: serve actual files if they exist, else index.html
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(dist_path, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_path, "index.html"))
