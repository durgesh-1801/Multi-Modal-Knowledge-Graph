"""
Query Intent Classifier Service.

Categorizes incoming user prompts into structured intent classes:
- policy_lookup
- compliance_question
- risk_analysis
- audit_question
- document_search
- requirement_lookup
- control_lookup
- general_chat
- greeting
- followup_question
"""

import re
from typing import Dict, Tuple
from app.core.logging import logger
from app.schemas.chat import QueryIntent


class QueryClassifier:
    """
    Service classifying user prompt intent using keyword heuristics, pattern rules, and confidence metrics.
    """

    INTENT_RULES: Dict[str, Tuple[str, float]] = {
        r"\b(hello|hi|hey|greetings|good morning|good afternoon)\b": ("greeting", 0.99),
        r"\b(policy|policies|procedure|guideline|document)\b": ("policy_lookup", 0.95),
        r"\b(risk|threat|vulnerability|mitigation|impact)\b": ("risk_analysis", 0.95),
        r"\b(audit|finding|auditor|non-conformity|inspection)\b": ("audit_question", 0.95),
        r"\b(control|mfa|encryption|firewall|access control)\b": ("control_lookup", 0.94),
        r"\b(requirement|mandatory|shall|must|obligation)\b": ("requirement_lookup", 0.93),
        r"\b(find|search|where is|located|pdf|document)\b": ("document_search", 0.90),
        r"\b(comply|compliance|regulation|gdpr|iso|hipaa|soc)\b": ("compliance_question", 0.95),
        r"\b(what about|how about|also|and then|why)\b": ("followup_question", 0.85),
    }

    def classify(self, query: str) -> QueryIntent:
        """
        Classifies a user query string into a QueryIntent model.

        Args:
            query: Raw user input prompt.

        Returns:
            QueryIntent: Detected intent category and confidence score.
        """
        if not query or not query.strip():
            return QueryIntent(intent="general_chat", confidence=0.50)

        q_lower = query.strip().lower()
        logger.info(f"Classifying query intent for: '{q_lower[:40]}...'")

        for pattern, (intent_name, conf) in self.INTENT_RULES.items():
            if re.search(pattern, q_lower, re.IGNORECASE):
                logger.info(f"Detected intent '{intent_name}' with confidence {conf}")
                return QueryIntent(intent=intent_name, confidence=conf)

        # Default fallback intent
        logger.info("Defaulting intent to 'compliance_question' (Confidence 0.85)")
        return QueryIntent(intent="compliance_question", confidence=0.85)
