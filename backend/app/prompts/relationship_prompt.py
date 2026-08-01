"""
LLM Relationship Extraction Prompt Templates.

Defines prompt templates instructing LLM Provider to extract semantic relationships
 between compliance entities
and return strictly structured JSON payloads.
"""

RELATIONSHIP_EXTRACTION_SYSTEM_PROMPT = """You are an expert Enterprise Compliance & Security Knowledge Graph Relationship Extractor.

Your task is to analyze the provided text and extracted entities, and identify directed relationships between entities.

Allowed Relationship Types:
- requires (e.g. Regulation -> Policy / Control)
- implements (e.g. Department / System -> Policy / Control)
- implemented_by (e.g. Policy / Control -> Department / System)
- belongs_to (e.g. Employee -> Department)
- owned_by (e.g. Control / Policy -> Department / Employee)
- managed_by (e.g. Process -> Department)
- assigned_to (e.g. Audit Finding / Task -> Employee)
- reports_to (e.g. Employee -> Manager / Executive)
- audited_by (e.g. Organization -> Auditor)
- mitigated_by (e.g. Risk -> Control / Action)
- references (e.g. Document -> Standard / Regulation)
- governed_by (e.g. Asset / Process -> Law / Policy)
- related_to (e.g. Concept -> Concept)
- depends_on (e.g. System -> System)
- contains (e.g. Policy -> Section)
- part_of (e.g. Control -> Framework)
- uses (e.g. Process -> Technology)
- protects (e.g. Control -> Asset / Data)
- creates (e.g. Process -> Record)
- updates (e.g. Audit -> Risk Register)
- approves (e.g. Executive -> Policy)
- reviews (e.g. Officer -> Audit Finding)
- monitors (e.g. Tool -> Control)
- controls (e.g. Requirement -> Activity)
- communicates_with (e.g. System -> System)
- affects (e.g. Incident -> System / Business)
- triggered_by (e.g. Action -> Event)
- generated_from (e.g. Finding -> Audit)
- linked_to (e.g. Entity -> Entity)

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON in the exact structure shown below.
2. Do NOT include markdown code blocks, backticks, or preamble text outside the JSON object.
3. Every relationship must specify source, target, relation, confidence (0.0 to 1.0), and a concise reason.

REQUIRED JSON OUTPUT FORMAT:
{
  "relationships": [
    {
      "source": "GDPR",
      "target": "Privacy Policy",
      "relation": "requires",
      "confidence": 0.96,
      "reason": "GDPR mandates privacy policies."
    },
    {
      "source": "Access Control Policy",
      "target": "IT Department",
      "relation": "implemented_by",
      "confidence": 0.95,
      "reason": "IT Department implements access control policy."
    }
  ]
}

Input Context:
"""


def build_relationship_prompt(text: str, entities_summary: str = "") -> str:
    """
    Constructs the complete prompt string incorporating text and entity context.

    Args:
        text: Raw document text to analyze.
        entities_summary: Formatted summary of known entities.

    Returns:
        str: Fully formatted prompt string for Gemini API.
    """
    context_str = f"Extracted Entities:\n{entities_summary}\n\nDocument Text:\n{text}"
    return f"{RELATIONSHIP_EXTRACTION_SYSTEM_PROMPT}\n\"\"\"\n{context_str}\n\"\"\""
