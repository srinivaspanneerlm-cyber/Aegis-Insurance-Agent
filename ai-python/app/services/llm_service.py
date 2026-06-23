from typing import List, Optional, Any
import json
import asyncio
import google.generativeai as genai
from openai import AsyncOpenAI
from app.config.config import settings
from app.utils.logger import logger
from app.utils.premium_calculator import calculate_premium

class LLMService:
    """
    Direct SDK Service for invoking OpenAI or Gemini with support for dynamic tool function calling.
    """
    def __init__(self):
        self.provider = settings.active_provider
        self.gemini_configured = False
        self.openai_configured = False
        self.openai_client = None

        try:
            if self.provider == "gemini":
                if settings.GEMINI_API_KEY:
                    genai.configure(api_key=settings.GEMINI_API_KEY)
                    self.gemini_configured = True
                    logger.info("Direct Gemini API client configured successfully.")
                else:
                    logger.warning("GEMINI_API_KEY missing in settings. Gemini will run in offline fallback mode.")

            elif self.provider == "openai":
                if settings.OPENAI_API_KEY:
                    self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
                    self.openai_configured = True
                    logger.info("Direct AsyncOpenAI API client configured successfully.")
                else:
                    logger.warning("OPENAI_API_KEY missing in settings. OpenAI will run in offline fallback mode.")
            else:
                logger.error(f"Unknown or unsupported active provider: {self.provider}")
        except Exception as e:
            logger.error(f"Error initializing LLM SDK clients: {e}. Fallback active.")

    async def generate_response(self, system_prompt: str, user_message: str, history: Optional[List] = None, tools: Optional[List] = None) -> str:
        """
        Generates an AI response by calling the active LLM provider directly (async) with support for tools and history.
        """
        if self.provider == "gemini":
            if not self.gemini_configured:
                raise ValueError("Gemini client is not configured (missing API Key).")
            
            logger.info("Invoking Gemini GenerativeModel (gemini-2.5-flash) with tools...")
            
            # Instantiate the Gemini model with system instruction and tools
            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=system_prompt,
                tools=tools
            )
            
            # Format chronological conversation context
            formatted_context = ""
            if history:
                for turn in history:
                    sender_label = "Customer" if turn["sender"] in ["customer", "user"] else "Aegis Advisor"
                    formatted_context += f"{sender_label}: {turn['message']}\n\n"
            
            final_prompt = f"{formatted_context}Customer: {user_message}\n\nAegis Advisor:"
            
            max_retries = 5
            backoff_factor = 2.0
            delay = 4.0
            
            for attempt in range(max_retries):
                try:
                    if tools:
                        logger.info("Gemini: Running automatic function calling loop inside async executor...")
                        # Start chat with automatic function call execution enabled
                        chat = model.start_chat(enable_automatic_function_calling=True)
                        
                        # Run sync chat call inside thread executor to maintain non-blocking concurrency
                        loop = asyncio.get_event_loop()
                        response = await loop.run_in_executor(None, lambda: chat.send_message(final_prompt))
                        logger.info("Gemini tool call response resolved.")
                        return response.text
                    else:
                        response = await model.generate_content_async(final_prompt)
                        logger.info("Gemini response resolved.")
                        return response.text
                except Exception as e:
                    err_msg = str(e)
                    if "429" in err_msg or "quota" in err_msg.lower() or "limit" in err_msg.lower():
                        if attempt < max_retries - 1:
                            logger.warning(f"Gemini API rate limited (429). Retrying in {delay} seconds (Attempt {attempt+1}/{max_retries})...")
                            await asyncio.sleep(delay)
                            delay *= backoff_factor
                            continue
                    raise e

        elif self.provider == "openai":
            if not self.openai_configured or self.openai_client is None:
                raise ValueError("OpenAI client is not configured (missing API Key or not initialized).")

            logger.info("Invoking OpenAI gpt-4o with tools...")
            
            messages = [{"role": "system", "content": system_prompt}]
            if history:
                for turn in history:
                    role = "user" if turn["sender"] in ["customer", "user"] else "assistant"
                    messages.append({"role": role, "content": turn["message"]})
            messages.append({"role": "user", "content": user_message})

            # Setup OpenAI Tool Schemas
            openai_tools = None
            if tools:
                openai_tools = []
                for tool in tools:
                    openai_tools.append({
                        "type": "function",
                        "function": {
                            "name": tool.__name__,
                            "description": tool.__doc__ or "Underwritten dynamic premium calculator.",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "age": {"type": "integer", "description": "The age of the primary insured person."},
                                    "coverage": {"type": "string", "description": "The coverage limit amount, e.g., '₹1 Crore Cover', '₹10 Lakh Cover', '₹50 Lakh Cover', '₹5 Crore Cover'."},
                                    "plan_name": {"type": "string", "description": "The name of the insurance plan."}
                                },
                                "required": ["age", "coverage", "plan_name"]
                            }
                        }
                    })

            response = await self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                tools=openai_tools,
                temperature=0.3
            )
            
            tool_calls = response.choices[0].message.tool_calls
            if tool_calls:
                logger.info("OpenAI: Caught tool call triggers, processing dispatch...")
                # Append assistant message (containing tool calls) to message history
                messages.append(response.choices[0].message)
                
                # Execute tool functions
                for tool_call in tool_calls:
                    if tool_call.function.name == "calculate_premium":
                        args = json.loads(tool_call.function.arguments)
                        logger.info(f"OpenAI: Executing calculate_premium with parameters: {args}")
                        
                        tool_result = calculate_premium(
                            age=int(args.get("age", 35)),
                            coverage=args.get("coverage", "₹1 Crore Cover"),
                            plan_name=args.get("plan_name", "Aegis Supreme Health Shield")
                        )
                        
                        # Add tool result output message to thread
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": json.dumps(tool_result)
                        })
                
                # Dispatch final completion to formulate conversational response containing calculator output
                second_response = await self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=messages,
                    temperature=0.3
                )
                logger.info("OpenAI tool call conversation resolved.")
                return second_response.choices[0].message.content or ""
            else:
                logger.info("OpenAI response resolved.")
                return response.choices[0].message.content or ""

        else:
            raise ValueError(f"Unsupported active chat model provider: {self.provider}")

_llm_service: Optional[LLMService] = None

def get_llm_service() -> LLMService:
    """
    Singleton getter for LLMService to reuse client connections.
    """
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
