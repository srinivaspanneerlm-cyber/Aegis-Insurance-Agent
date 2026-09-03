from pydantic import BaseModel, Field, StringConstraints
from typing import Annotated, List, Optional


class ChatHistoryMessage(BaseModel):
    """Single message turn — accepts both frontend format {role,content} and backend format {sender,message}."""
    sender: Optional[str] = Field(None, max_length=32, description="'customer' or 'advisor' (backend format)")
    message: Optional[str] = Field(None, max_length=8000, description="Message text (backend format)")
    role: Optional[str] = Field(None, max_length=32, description="'user' or 'assistant' (frontend/OpenAI format)")
    content: Optional[str] = Field(None, max_length=8000, description="Message text (frontend/OpenAI format)")

    def get_sender(self) -> str:
        """Normalize to sender: 'customer' or 'advisor'."""
        if self.sender:
            return self.sender
        return "customer" if self.role in ("user", "customer") else "advisor"

    def get_message(self) -> str:
        """Normalize to message text."""
        return self.message or self.content or ""

    def dict(self, **kwargs):
        """Always serialize as {sender, message} for internal pipeline compatibility."""
        return {"sender": self.get_sender(), "message": self.get_message()}


class VoiceTurnMeta(BaseModel):
    """
    How a turn was spoken, when it was spoken at all.

    Optional and absent on every typed turn, which is what makes typed chat
    provably unchanged: no block, no adaptation, the same prompt as before.

    Nothing here reaches a decision. It is read once, in
    `BaseInsuranceAgent._voice_style_context`, to choose a block of phrasing
    guidance — see `app/prompts/voice_style_prompts`. Bounded like every other
    external field: `style` is validated against a known set on the way in, and
    an unrecognised value becomes `normal` rather than an error, because voice
    adaptation failing must never cost a customer their answer.
    """

    style: Optional[str] = Field(
        None,
        max_length=32,
        description=(
            "How the message was worded: normal | confused | frustrated | "
            "urgent | brief. A description of the wording, never a claim about "
            "the customer. Unknown values fall back to 'normal'."
        ),
    )
    language: Optional[str] = Field(
        None,
        max_length=16,
        description=(
            "What the transcription service heard — 'en-IN', 'ta-IN', 'ta-en'. "
            "Metadata only. Aegis answers in English unless the customer asks "
            "for another language in words; speaking Tamil is not asking for it."
        ),
    )
    spoken: bool = Field(
        True, description="False disables every adaptation, as on a typed turn."
    )


class ChatRequest(BaseModel):
    """AI chat request schema."""
    # Bounded input sizes — a single request can never carry an unbounded
    # prompt that would inflate paid-LLM cost or exhaust memory (DoS). Limits
    # are generous enough that no legitimate conversation is ever rejected.
    message: str = Field(..., min_length=1, max_length=8000, description="Customer's message")
    history: Optional[List[ChatHistoryMessage]] = Field(
        None, max_length=100, description="Chronological previous chat messages"
    )
    user_name: Optional[str] = Field("Sri", max_length=200, description="Authenticated customer name")
    user_id: Optional[str] = Field(
        None,
        max_length=200,
        description=(
            "The backend's stable, authenticated customer id. Preferred over "
            "user_name for memory/profile isolation — two customers can share "
            "a display name, never a user_id."
        ),
    )
    product_type: Optional[str] = Field(
        None, max_length=64, description="Explicit category: motor | health | travel | home-property | miscellaneous"
    )
    session_id: Optional[str] = Field(
        None, max_length=200, description="Session ID for active recommendation context and agent continuity"
    )
    force_transfer_to: Optional[str] = Field(
        None,
        max_length=64,
        description=(
            "Force route to this domain agent, bypassing detection. "
            "Set ONLY when the user has explicitly approved the transfer in the UI."
        )
    )
    voice: Optional[VoiceTurnMeta] = Field(
        None,
        description=(
            "Present only when the customer spoke this turn. Controls how the "
            "reply is worded and never what it says."
        ),
    )
    declined_domains: List[Annotated[str, StringConstraints(max_length=64)]] = Field(
        default_factory=list,
        max_length=16,
        description=(
            "Domains the user has already declined to switch to. Interrupt "
            "detection still runs, but a switch to a declined domain is not "
            "offered again — the message goes to the active agent instead. "
            "Per-domain and for the whole session, mirroring the UI rule that "
            "a refused advisor stops asking."
        )
    )


class ChatResponse(BaseModel):
    """AI chat response schema — includes multi-agent routing metadata."""
    reply: str = Field(..., description="Agent's response text")
    agent_name: Optional[str] = Field(None, description="Name of responding agent (e.g. 'Sarah AI')")
    agent_domain: Optional[str] = Field(None, description="Domain of responding agent (e.g. 'health')")
    transferred: bool = Field(False, description="True if domain transfer was executed in this turn")
    suggest_transfer: bool = Field(False, description="True if agent suggests a transfer — user must approve")
    transfer_from: Optional[str] = Field(None, description="Domain key of outgoing agent")
    transfer_from_name: Optional[str] = Field(None, description="Name of outgoing agent")
    transfer_to: Optional[str] = Field(None, description="Domain key of suggested/incoming agent")
    transfer_to_name: Optional[str] = Field(None, description="Name of suggested/incoming agent")
    transfer_reason: Optional[str] = Field(None, description="Domain key that triggered the transfer suggestion")
    previous_agent: Optional[str] = Field(None, description="Domain key of agent before last transfer (for restore)")
    session_id: Optional[str] = Field(None, description="Session ID for continuity")
    is_interrupt: bool = Field(
        False,
        description=(
            "True when this suggest_transfer was triggered by mid-workflow interrupt "
            "detection (user changed topic). Shows specialized 'progress saved' dialog."
        )
    )


# ---------------------------------------------------------------------------
# UI Action Engine schemas — bypass the chat/intent pipeline entirely
# ---------------------------------------------------------------------------

class UIActionRequest(BaseModel):
    """Structured event from frontend button clicks. Never touches chat pipeline."""
    type: str = Field("ui_action", description="Must be 'ui_action'")
    action: str = Field(
        ...,
        description=(
            "One of: view_details, compare_plans, select_plan, purchase_plan, "
            "download_brochure, share_plan, contact_advisor, schedule_callback"
        )
    )
    session_id: Optional[str] = Field(None, description="Session ID from previous interaction")
    plan_id: Optional[str] = Field(None, description="Optional plan identifier")
    session_data: Optional[dict] = Field(None, description="Full recommendation/plan data")


class UIActionResponse(BaseModel):
    """Response from the UI Action Engine."""
    type: str = Field("ui_action_response")
    action: str
    session_id: str
    status: str
    response_type: str
    data: dict
    message: Optional[str] = None
