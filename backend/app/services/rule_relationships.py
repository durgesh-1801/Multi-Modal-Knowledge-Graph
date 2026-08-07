"""
Rule-Based Relationship Extractor Service.

Uses sentence segmentation, entity co-occurrence, and configurable regex verbal patterns
to extract relationships such as requires, implements, implemented_by, belongs_to,
managed_by, reports_to, controlled_by, depends_on, owned_by, mitigated_by, governed_by, references.
"""

import re
from typing import Dict, List, Tuple, Optional
from app.core.logging import logger
from app.schemas.entity import Entity
from app.schemas.relationship import Relationship


class RuleRelationshipExtractor:
    """
    Rule-based extractor analyzing sentence boundaries, verbal link patterns,
    and SpaCy dependency trees between entities.
    """

    # Verbal Pattern Regex rules mapping to canonical relation types
    RELATION_PATTERNS: List[Tuple[str, str, bool]] = [
        # (regex_pattern, canonical_relation, is_reverse)
        (r"\b(follows?|complies?\s+with|adheres?\s+to|conforms?\s+to)\b", "follows", False),
        (r"\b(is\s+)?accessible\s+(by|to)\b|\baccessed\s+by\b", "accessible_by", False),
        (r"\b(is\s+)?retained\s+for\b|\bstored\s+for\b|\bretained\s+until\b", "retained_for", False),
        (r"\b(is\s+)?encrypted\s+(using|with)\b|\bsecured\s+(using|with)\b", "encrypted_using", False),
        (r"\b(is\s+)?implemented\s+by\b", "implemented_by", False),
        (r"\bimplements?\b", "implements", False),
        (r"\b(is\s+)?required\s+by\b", "requires", True),
        (r"\b(requires?|mandates?|demands?)\b", "requires", False),
        (r"\bbelongs?\s+to\b", "belongs_to", False),
        (r"\b(is\s+)?managed\s+by\b", "managed_by", False),
        (r"\b(is\s+)?owned\s+by\b", "owned_by", False),
        (r"\b(is\s+)?assigned\s+to\b", "assigned_to", False),
        (r"\bassigns?\s+to\b", "assigned_to", True),
        (r"\breports?\s+to\b", "reports_to", False),
        (r"\b(is\s+)?mitigated\s+by\b", "mitigated_by", False),
        (r"\bmitigates?\b", "mitigated_by", True),
        (r"\b(is\s+)?governed\s+by\b", "governed_by", False),
        (r"\bgoverns?\b", "governed_by", True),
        (r"\bdepends?\s+on\b", "depends_on", False),
        (r"\b(is\s+)?controlled\s+by\b", "controls", True),
        (r"\bcontrols?\b", "controls", False),
        (r"\b(is\s+)?approved\s+by\b", "approves", True),
        (r"\bapproves?\b", "approves", False),
        (r"\b(is\s+)?reviewed\s+by\b", "reviews", True),
        (r"\breviews?\b", "reviews", False),
        (r"\b(is\s+)?audited\s+by\b", "audited_by", False),
        (r"\breferences?|cites?\b", "references", False),
        (r"\b(is\s+)?part\s+of\b", "part_of", False),
        (r"\bcontains?\b", "contains", False),
        (r"\buses?|utilizes?\b", "uses", False),
        (r"\bprotects?|secures?\b", "protects", False),
        (r"\benforces?\b", "enforces", False),
        (r"\bapplies?\s+to\b", "applies_to", False),
    ]

    def __init__(self) -> None:
        self._nlp = None

    def _get_spacy(self):
        if self._nlp is None:
            try:
                import spacy
                self._nlp = spacy.load("en_core_web_sm")
            except Exception:
                self._nlp = "UNAVAILABLE"
        return self._nlp if self._nlp != "UNAVAILABLE" else None

    def extract(self, text: str, entities: List[Entity]) -> List[Relationship]:
        """
        Extracts relationships between entities present in sentence contexts.

        Args:
            text: Input document text.
            entities: Known extracted entities.

        Returns:
            List[Relationship]: List of rule-extracted relationship edges.
        """
        if not text or not entities or len(entities) < 2:
            return []

        logger.info("Executing Stage 1: Rule-Based & Linguistic Relationship Extraction.")
        relationships: List[Relationship] = []

        # Deduplicate and cap entities to top 150 distinct non-empty names
        ent_map = {}
        for ent in entities:
            name_clean = ent.name.strip()
            if len(name_clean) >= 2 and name_clean.lower() not in ent_map:
                ent_map[name_clean.lower()] = ent
        target_entities = list(ent_map.values())[:150]

        if len(target_entities) < 2:
            return []

        # Split text into sentence clauses, filtering out trivial/empty lines
        sentences = [s.strip() for s in re.split(r"[.!?\n]+", text) if 15 <= len(s.strip()) <= 500][:2000]

        for sentence in sentences:
            clean_sent = sentence
            clean_sent_lower = clean_sent.lower()

            # Find all entities present in this sentence
            present_entities: List[Tuple[int, Entity]] = []
            for ent in target_entities:
                idx = clean_sent_lower.find(ent.name.lower())
                if idx != -1:
                    present_entities.append((idx, ent))

            # Sort entities by occurrence position in sentence
            present_entities.sort(key=lambda x: x[0])

            if len(present_entities) >= 2:
                # Compare adjacent entity pairs in sentence
                for i in range(len(present_entities) - 1):
                    _, e1 = present_entities[i]
                    _, e2 = present_entities[i + 1]

                    if e1.name.lower() == e2.name.lower():
                        continue

                    # Substring text between entity 1 and entity 2
                    pos_e1 = clean_sent.lower().find(e1.name.lower())
                    pos_e2 = clean_sent.lower().find(e2.name.lower())
                    start_sub = pos_e1 + len(e1.name)
                    sub_text = clean_sent[start_sub:pos_e2] if pos_e2 > start_sub else clean_sent

                    # Match patterns against connecting text
                    matched_rel = self._match_pattern(sub_text) or self._match_pattern(clean_sent)
                    if matched_rel:
                        rel_type, is_reverse = matched_rel
                        source_ent = e2.name if is_reverse else e1.name
                        target_ent = e1.name if is_reverse else e2.name
                        confidence = 0.95
                    else:
                        rel_type = "related_to"
                        source_ent = e1.name
                        target_ent = e2.name
                        confidence = 0.85

                    relationships.append(
                        Relationship(
                            source=source_ent,
                            target=target_ent,
                            relation=rel_type,
                            confidence=confidence,
                            source_engine="Rule-Based",
                            reason=f"Pattern / linguistic match: '{clean_sent[:80]}...'",
                            metadata={"sentence": clean_sent},
                        )
                    )

        logger.info(f"Rule-Based Relationship Extractor identified {len(relationships)} edges.")
        return relationships

    def _match_pattern(self, text_clause: str) -> Tuple[str, bool] | None:
        """Matches verbal regex patterns in connecting clause text."""
        for pattern, rel_type, is_reverse in self.RELATION_PATTERNS:
            if re.search(pattern, text_clause, re.IGNORECASE):
                return rel_type, is_reverse
        return None
