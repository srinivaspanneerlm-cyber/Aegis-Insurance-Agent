from pydantic import BaseModel, Field
from typing import List, Optional

class ChatHistoryMessage(BaseModel):
    """
    Schema representing a single message turn in the conversation history.
    """
    sender: str = Field(..., description="The sender of the message: 'customer' (or 'user') vs 'advisor' (or 'ai').")
    message: str = Field(..., description="The text content of the message.")

class ChatRequest(BaseModel):
    """
    Schema for validating AI chat requests, optionally including conversation history.
    """
    message: str = Field(
        ..., 
        description="The customer's message containing insurance inquiries or underwriting details.",
        examples=["Need family insurance", "Protect my family within a 5000/mo budget"]
    )
    history: Optional[List[ChatHistoryMessage]] = Field(
        None,
        description="Optional list of chronological previous chat messages in the session."
    )
    user_name: Optional[str] = Field(
        "Sri",
        description="Optional name of the authenticated customer."
    )
    product_type: Optional[str] = Field(
        None,
        description="Optional explicit category of insurance selected (motor, health, travel, property, miscellaneous)."
    )

class ChatResponse(BaseModel):
    """
    Schema for returning AI chat responses.
    """
    reply: str = Field(
        ...,
        description="The AI agent's empathetic and professional response advice.",
        examples=["Based on your family parameters, I highly recommend Aegis Supreme Health Shield..."]
    )


