"""Team Routes — Read active members."""

from fastapi import APIRouter
from ..database import query

router = APIRouter()


@router.get("")
def list_team():
    return query("SELECT * FROM team_members WHERE is_active = true ORDER BY name")
