"""Team Routes — CRUD for team members."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..database import query, execute, gen_id

router = APIRouter()


class TeamMemberCreate(BaseModel):
    name: str = ""
    role: str = "member"
    title: str = ""
    avatar_color: str = "#38456D"
    is_active: bool = True
    email: str = ""
    phone: str = ""


class TeamMemberUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    title: Optional[str] = None
    avatar_color: Optional[str] = None
    is_active: Optional[bool] = None
    email: Optional[str] = None
    phone: Optional[str] = None


@router.get("")
def list_team(include_inactive: bool = False):
    if include_inactive:
        return query("SELECT * FROM team_members ORDER BY name")
    return query("SELECT * FROM team_members WHERE is_active = true ORDER BY name")


@router.get("/{member_id}")
def get_member(member_id: str):
    rows = query("SELECT * FROM team_members WHERE id = %s", (member_id,))
    if not rows:
        return {"error": "Not found"}
    return rows[0]


@router.post("", status_code=201)
def create_member(data: TeamMemberCreate):
    member_id = gen_id("tm_")
    rows = query(
        """INSERT INTO team_members (id, name, role, title, avatar_color, is_active, email, phone)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
           RETURNING *""",
        (
            member_id, data.name, data.role, data.title, data.avatar_color,
            data.is_active, data.email, data.phone,
        ),
    )
    return rows[0]


@router.patch("/{member_id}")
def update_member(member_id: str, data: TeamMemberUpdate):
    current_rows = query("SELECT * FROM team_members WHERE id = %s", (member_id,))
    if not current_rows:
        return {"error": "Not found"}

    fields = []
    params = []
    data_dict = data.model_dump(exclude_unset=True)

    allowed = ["name", "role", "title", "avatar_color", "is_active", "email", "phone"]

    for key in allowed:
        if key in data_dict:
            fields.append(f"{key} = %s")
            params.append(data_dict[key])

    if not fields:
        return current_rows[0]

    params.append(member_id)
    sql = f"UPDATE team_members SET {', '.join(fields)} WHERE id = %s RETURNING *"
    rows = query(sql, tuple(params))
    return rows[0]


@router.delete("/{member_id}")
def delete_member(member_id: str):
    execute("DELETE FROM team_members WHERE id = %s", (member_id,))
    return {"ok": True}
