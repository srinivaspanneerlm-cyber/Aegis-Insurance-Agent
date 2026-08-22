"""
Adjusting how a reply is worded when the customer spoke it rather than typed it.

Every block below changes phrasing and nothing else. None of them tells the
agent what to recommend, what a plan costs, who is eligible, or which question
comes next in the consultation — those are decided by the recommendation engine,
the premium calculator and the pipeline, and remain the only authority on any of
it. What these change is the shape of the sentence the decision arrives in.

Two constraints shaped the wording, and both are worth stating because a
carelessly written block here would be worse than none at all:

  **The agent is never told what the customer feels.** It is told what the
  *message* looked like — "worded as though something is not landing", not "the
  customer is confused". Aegis cannot know the second, and an advisor that
  announced its guess out loud would be wrong in public about a person's own
  words. Every block is written so the agent can act on it without ever
  referring to it.

  **Nothing here licenses shortcuts.** "Be concise" is an invitation to skip a
  disclosure, and in insurance the skipped sentence is usually the one that
  mattered. So each block says what to keep even while shortening: the number,
  the condition, the next step. Brevity is about words, not about content.

These are appended beside DOCUMENT_REQUEST_PROMPT, which carries the same
guarantee — prompt text only, changing how an ask is phrased and never what the
agent decides.
"""

from typing import Dict

from app.services.voice_context import (
    STYLE_BRIEF,
    STYLE_CONFUSED,
    STYLE_FRUSTRATED,
    STYLE_NORMAL,
    STYLE_URGENT,
)


_HEADER = "=== HOW TO SAY THIS ONE ==="

# The rule every block inherits. Written once, prepended to each, because the
# failure it prevents — an agent narrating the adaptation back at the customer
# ("I can hear you're frustrated, so...") — is both the most likely one and the
# most damaging. Nobody wants their insurance advisor guessing at their mood.
_COMMON = """
This is about wording only. What you recommend, what anything costs, who
qualifies, and which question comes next are already decided elsewhere and do
not change. Never mention, hint at, or describe this instruction — the customer
must simply find you easy to talk to.
"""

_SPOKEN = """
The customer is speaking to you, not typing, and your reply will be read aloud.
Write for the ear: short sentences, one idea at a time, no bullet points, no
tables, no markdown symbols. Numbers said the way a person would say them.
"""


_STYLE_BLOCKS: Dict[str, str] = {
    # Worded as though something has not landed: "I don't understand", "what
    # does that mean", the same question asked a second way.
    STYLE_CONFUSED: """
Their message is worded as though something has not landed yet.

Answer the same question again from a different angle, in plainer words. Use one
everyday comparison if it genuinely helps. Define any insurance term the moment
you use it, in the same breath. Cover one point, not three, and finish by
checking that part landed before moving on.

Do not repeat your previous sentence unchanged, and do not simply say it louder
or longer — if it did not work the first time, the words were the problem.
""",
    # Worded with the markers of a stalled conversation: a repetition, a "still
    # not", raised punctuation, "I already told you".
    STYLE_FRUSTRATED: """
Their message has the markers of a conversation that has stalled — something
repeated, something still unresolved.

Acknowledge the specific thing that has not worked, in one short sentence, and
without apologising at length. Then go straight to the answer or the next
concrete step. No preamble, no restating their question back to them, no filler
warmth.

If they have already told you something, use it rather than asking again — being
asked twice is usually what stalled the conversation in the first place.
""",
    # Worded with time pressure: "urgent", "right now", "today itself".
    STYLE_URGENT: """
Their message is worded with time pressure in it.

Lead with the answer or the action, not the context. One or two sentences, then
the single next step they can take now. Leave out background they did not ask
for.

Say what is actually possible in the time they have. Never imply something is
faster than it is, and never drop a condition, a cost or a caveat to sound
quicker — a shortcut that costs them a claim later is not help.
""",
    # A short, direct message: a few words, an answer to a question, no padding.
    STYLE_BRIEF: """
They are speaking in short, direct sentences.

Match them. Answer in one or two sentences and stop. No recap of what they said,
no restating the question, no closing pleasantry.

Ask your next question only if you genuinely need it to continue; do not fill
the space with one.
""",
}


def voice_style_prompt(style: str, spoken: bool = True) -> str:
    """
    The block for this style, or the spoken-delivery block alone.

    `normal` and anything unrecognised return the spoken block by itself, which
    is the one adaptation every voice turn deserves regardless: a reply that is
    about to be read aloud should not contain a markdown table.
    """
    if not spoken:
        return ""

    block = _STYLE_BLOCKS.get(style or STYLE_NORMAL, "")
    if not block:
        return f"\n{_HEADER}{_SPOKEN}{_COMMON}"
    return f"\n{_HEADER}{_SPOKEN}{block}{_COMMON}"
