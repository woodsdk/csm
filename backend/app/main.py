"""SynergyHub — FastAPI Application."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import init as db_init
from .routes import tasks, customers, team, activities, shifts, bookings


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

# Serve frontend static files in production
dist_path = os.path.abspath(settings.frontend_dist)
if os.path.isdir(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="frontend")
