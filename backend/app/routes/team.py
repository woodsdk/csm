"""Team Routes — CRUD for team members + photo upload."""

import base64
from fastapi import APIRouter, UploadFile, File
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


@router.post("/{member_id}/photo")
async def upload_photo(member_id: str, file: UploadFile = File(...)):
    """Upload a portrait photo for a team member. Stored as base64 data URL."""
    rows = query("SELECT id FROM team_members WHERE id = %s", (member_id,))
    if not rows:
        return {"error": "Not found"}

    content_type = file.content_type or "image/jpeg"
    if not content_type.startswith("image/"):
        return {"error": "Kun billedfiler er tilladt"}

    img_bytes = await file.read()
    if len(img_bytes) > 5 * 1024 * 1024:
        return {"error": "Billedet er for stort (max 5 MB)"}

    b64 = base64.b64encode(img_bytes).decode("utf-8")
    data_url = f"data:{content_type};base64,{b64}"

    result = query(
        "UPDATE team_members SET photo_data = %s WHERE id = %s RETURNING *",
        (data_url, member_id),
    )
    return result[0] if result else {"ok": True}


@router.delete("/{member_id}/photo")
def delete_photo(member_id: str):
    """Remove a team member's portrait photo."""
    query(
        "UPDATE team_members SET photo_data = NULL WHERE id = %s RETURNING id",
        (member_id,),
    )
    return {"ok": True}


@router.delete("/{member_id}")
def delete_member(member_id: str):
    execute("DELETE FROM team_members WHERE id = %s", (member_id,))
    return {"ok": True}
