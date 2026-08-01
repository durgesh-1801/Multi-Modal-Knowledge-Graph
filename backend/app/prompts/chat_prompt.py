"""
Conversational AI System Prompt Templates.

Defines prompt templates instructing LLM Provider to answer compliance queries conversationally,
grounded strictly in retrieved context and historical chat turns.
"""

CHAT_SYSTEM_PROMPT = """You are an Enterprise Compliance Conversational Assistant.

Your task is to provide clear, helpful, and grounded answers to the user's compliance question, using the RETRIEVED CONTEXT and CONVERSATION HISTORY below.

STRICT COMPLIANCE RULES:
1. Answer ONLY using information from the RETRIEVED CONTEXT.
2. NEVER hallucinate, fabricate regulations, invent policies, invent risks, or fabricate compliance requirements.
3. If the retrieved context is insufficient or missing evidence to answer the user's question, you MUST respond EXACTLY:
   "I couldn't find sufficient evidence in the uploaded documents."
4. Always explain your reasoning clearly and cite supporting evidence or document names.
5. Maintain a professional, executive-ready tone suitable for compliance officers, legal auditors, and IT managers.

CONVERSATION HISTORY:
{history_str}

RETRIEVED CONTEXT:
{context_str}

USER QUERY:
{query}
"""


def build_chat_prompt(query: str, combined_context: str, history_summary: str = "") -> str:
    """
    Constructs the conversational chat prompt string.

    Args:
        query: Current user query.
        combined_context: Formatted vector + graph context string.
        history_summary: Formatted conversation history string.

    Returns:
        str: Formatted Gemini chat prompt.
    """
    hist_text = history_summary.strip() if history_summary.strip() else "No previous conversation history."
    return CHAT_SYSTEM_PROMPT.format(
        history_str=hist_text,
        context_str=combined_context,
        query=query,
    )
