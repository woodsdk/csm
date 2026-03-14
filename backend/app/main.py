"""SynergyHub — FastAPI Application."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import init as db_init
from .routes import tasks, customers, team, activities, shifts, bookings, demos, training, faq, helpdesk, onboarding


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    try:
        db_init()
    except Exception as e:
        print(f"Database init warning: {e}")
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
