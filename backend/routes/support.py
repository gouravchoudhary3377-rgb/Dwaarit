"""AI Support Bot powered by emergentintegrations (OpenAI gpt-4o-mini default)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from config import EMERGENT_LLM_KEY
from database import db
from models import SupportChatIn
from security import get_current_user, require_admin

router = APIRouter(prefix="/support", tags=["support"])

SYSTEM_PROMPT = (
    "You are Dwaarit's friendly customer support assistant for an Indian grocery delivery app "
    "(similar to Blinkit). Help users with: order status, refunds, payment issues, address changes, "
    "wallet usage, delivery timing (10-20 mins), product availability, and account questions. "
    "Be concise, polite, and use INR (\u20b9) for prices. If a user reports a problem that you cannot "
    "resolve, tell them their ticket has been escalated to a human agent."
)


async def _ai_reply(session_id: str, user_message: str, ticket_history: list[dict]) -> str:
    if not EMERGENT_LLM_KEY:
        return (
            "AI assistant is currently offline. We've created a ticket and our team will reach out shortly."
        )
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        chat = (
            LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=SYSTEM_PROMPT)
            .with_model("openai", "gpt-4o-mini")
            .with_params(max_tokens=400, temperature=0.4)
        )
        msg = UserMessage(text=user_message)
        resp = await chat.send_message(msg)
        return str(resp)
    except Exception as e:  # graceful fallback
        return (
            f"I'm having trouble reaching the assistant right now ({type(e).__name__}). "
            "Your message has been logged and our team will respond shortly."
        )


@router.get("/tickets")
async def list_tickets(user: dict = Depends(get_current_user)):
    docs = await db.support_tickets.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("updated_at", -1).to_list(50)
    return docs


@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    ticket = await db.support_tickets.find_one(
        {"ticket_id": ticket_id}, {"_id": 0}
    )
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    if ticket["user_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    messages = await db.support_messages.find(
        {"ticket_id": ticket_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return {"ticket": ticket, "messages": messages}


@router.post("/chat")
async def chat(body: SupportChatIn, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    ticket_id = body.ticket_id
    if not ticket_id:
        ticket_id = f"tkt_{uuid.uuid4().hex[:12]}"
        await db.support_tickets.insert_one({
            "ticket_id": ticket_id,
            "user_id": user["user_id"],
            "user_email": user["email"],
            "subject": body.message[:80],
            "status": "open",
            "created_at": now,
            "updated_at": now,
        })
    else:
        existing = await db.support_tickets.find_one({"ticket_id": ticket_id})
        if not existing or existing["user_id"] != user["user_id"]:
            raise HTTPException(404, "Ticket not found")

    # log user message
    await db.support_messages.insert_one({
        "ticket_id": ticket_id,
        "role": "user",
        "content": body.message,
        "created_at": now,
    })

    history = await db.support_messages.find(
        {"ticket_id": ticket_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(50)

    reply = await _ai_reply(ticket_id, body.message, history)

    bot_msg = {
        "ticket_id": ticket_id,
        "role": "assistant",
        "content": reply,
        "created_at": datetime.now(timezone.utc),
    }
    await db.support_messages.insert_one(bot_msg)
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"updated_at": datetime.now(timezone.utc)}},
    )
    return {"ticket_id": ticket_id, "reply": reply}


@router.get("/admin/tickets")
async def admin_list_tickets(_: dict = Depends(require_admin)):
    docs = await db.support_tickets.find({}, {"_id": 0}).sort(
        "updated_at", -1
    ).to_list(500)
    return docs
