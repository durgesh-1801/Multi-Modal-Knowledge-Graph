"""
Entity Normalizer & Rule-Based Extractor Service.

Provides:
- Rule-based regex extraction for compliance standards (ISO 27001, SOC 2, GDPR, HIPAA, PCI DSS, NIST),
  control IDs, policy numbers, emails, phone numbers, URLs, dates.
- Name casing, whitespace, and abbreviation normalization.
- Exact match, case-insensitive, and fuzzy string similarity deduplication.
"""

import re
from difflib import SequenceMatcher
from typing import Dict, List, Set, Tuple
from app.core.logging import logger
from app.schemas.entity import Entity, NormalizedEntity


class EntityNormalizer:
    """
    Isolated service handling rule-based regex extraction, canonical entity normalization,
    and fuzzy similarity deduplication.
    """

    # Canonical Standardization Mapping Table
    CANONICAL_MAP: Dict[str, Tuple[str, str]] = {
        "ISO27001": ("ISO 27001", "Standard"),
        "ISO-27001": ("ISO 27001", "Standard"),
        "ISO 27001": ("ISO 27001", "Standard"),
        "ISO 27001:2022": ("ISO 27001", "Standard"),
        "GDPR": ("GDPR", "Regulation"),
        "GENERAL DATA PROTECTION REGULATION": ("GDPR", "Regulation"),
        "SOC2": ("SOC 2", "Standard"),
        "SOC-2": ("SOC 2", "Standard"),
        "SOC 2 TYPE II": ("SOC 2", "Standard"),
        "SOC 2": ("SOC 2", "Standard"),
        "HIPAA": ("HIPAA", "Regulation"),
        "HEALTH INSURANCE PORTABILITY AND ACCOUNTABILITY ACT": ("HIPAA", "Regulation"),
        "PCI-DSS": ("PCI DSS", "Standard"),
        "PCI DSS": ("PCI DSS", "Standard"),
        "NIST": ("NIST CSF", "Framework"),
        "NIST CSF": ("NIST CSF", "Framework"),
        "NIST SP 800-53": ("NIST SP 800-53", "Standard"),
        "NIST-800-53": ("NIST SP 800-53", "Standard"),
        "COBIT": ("COBIT", "Framework"),
    }

    # Rule-Based Regex Patterns
    PATTERNS = {
        "Regulation_Standard": (
            r"\b(ISO[- ]?27001(?::2022)?|GDPR|HIPAA|SOC[- ]?2(?:\s+Type\s+II)?|PCI[- ]?DSS|NIST(?:\s+SP\s+800-53)?|COBIT)\b"
        ),
        "Control_ID": r"\b([A-Z]{2,4}-\d{1,4}|[A-Z]{2,3}\.[A-Z]{2}-\d{1,2}|CTRL-\d{3,4})\b",
        "Policy_Number": r"\b(POL-[A-Z0-9-]+|POLICY-\d{3,4})\b",
        "Document_ID": r"\b(DOC-\d{3,6}|REPORT-\d{4}-\d{2})\b",
        "Email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        "Phone": r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b",
        "URL": r"\bhttps?://[^\s/$.?#].[^\s]*\b",
        "Date": r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|Q[1-4]\s?\d{4})\b",
    }

    def extract_rules(self, text: str) -> List[Entity]:
        """
        Executes Stage 2 Rule-based regex pattern extraction against input text.

        Args:
            text: Raw input document text.

        Returns:
            List[Entity]: Extracted rule-based entities.
        """
        if not text or not text.strip():
            return []

        logger.info("Executing Stage 2: Rule-Based Pattern Extraction.")
        entities: List[Entity] = []

        for category, pattern in self.PATTERNS.items():
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                raw_val = match.group(0).strip()
                if not raw_val:
                    continue

                entity_type = category.replace("_Standard", "").replace("_ID", "")
                if category == "Regulation_Standard":
                    entity_type = "Regulation" if raw_val.upper() in ["GDPR", "HIPAA"] else "Standard"

                entities.append(
                    Entity(
                        name=raw_val,
                        type=entity_type,
                        confidence=0.98,
                        source="Rule-Based",
                        description=f"Extracted via Regex Rule ({category})",
                        metadata={"regex_category": category},
                    )
                )

        logger.info(f"Rule-Based extractor identified {len(entities)} entities.")
        return entities

    def normalize_entity(self, entity: Entity) -> NormalizedEntity:
        """
        Normalizes whitespace, casing, and standardizes abbreviation names for an entity.

        Args:
            entity: Input raw entity.

        Returns:
            NormalizedEntity: Canonicalized entity object.
        """
        clean_name = " ".join(entity.name.strip().split())
        upper_name = clean_name.upper()

        canonical_name = clean_name
        canonical_type = entity.type

        # Check Canonical Standardization Table
        if upper_name in self.CANONICAL_MAP:
            canonical_name, canonical_type = self.CANONICAL_MAP[upper_name]
        else:
            # Proper casing for unknown words
            if clean_name.islower() or clean_name.isupper():
                canonical_name = clean_name.title()

        return NormalizedEntity(
            name=entity.name,
            type=canonical_type,
            confidence=entity.confidence,
            source=entity.source,
            description=entity.description,
            metadata=entity.metadata,
            normalized_name=canonical_name,
            aliases=[clean_name] if clean_name != canonical_name else [],
        )

    def normalize_and_deduplicate(self, entities: List[Entity]) -> List[Entity]:
        """
        Normalizes entity attributes and deduplicates using exact, case-insensitive,
        and fuzzy string similarity matching.

        Args:
            entities: List of raw extracted entities from all stages.

        Returns:
            List[Entity]: Unique, normalized, and deduplicated entities.
        """
        if not entities:
            return []

        logger.info(f"Normalizing and deduplicating {len(entities)} total raw extractions.")

        # 1. Normalize every entity
        normalized_list: List[NormalizedEntity] = [self.normalize_entity(e) for e in entities]

        # 2. Group by Canonical Name & Type
        merged_map: Dict[str, NormalizedEntity] = {}

        for n_ent in normalized_list:
            key = f"{n_ent.normalized_name.lower()}::{n_ent.type.lower()}"

            if key not in merged_map:
                # Check fuzzy string similarity with existing keys
                matched_key = self._find_fuzzy_match(n_ent.normalized_name, n_ent.type, merged_map)
                if matched_key:
                    key = matched_key

            if key in merged_map:
                existing = merged_map[key]
                # Merge aliases
                all_aliases = set(existing.aliases + n_ent.aliases + [n_ent.name])
                existing.aliases = list(all_aliases)

                # Update confidence to highest score
                existing.confidence = max(existing.confidence, n_ent.confidence)

                # Merge sources
                if n_ent.source not in existing.source:
                    existing.source = f"{existing.source}+{n_ent.source}"

                # Retain richer description
                if not existing.description and n_ent.description:
                    existing.description = n_ent.description
            else:
                merged_map[key] = n_ent

        # Convert back to standard Entity list with canonical normalized names
        final_entities: List[Entity] = []
        for n_ent in merged_map.values():
            final_entities.append(
                Entity(
                    name=n_ent.normalized_name,
                    type=n_ent.type,
                    confidence=round(n_ent.confidence, 4),
                    source=n_ent.source,
                    description=n_ent.description,
                    metadata={**n_ent.metadata, "aliases": n_ent.aliases},
                )
            )

        logger.info(f"Deduplication complete. Retained {len(final_entities)} canonical entities.")
        return final_entities

    @staticmethod
    def _find_fuzzy_match(
        name: str, entity_type: str, merged_map: Dict[str, NormalizedEntity]
    ) -> str:
        """Finds fuzzy string similarity match in existing merged_map."""
        name_low = name.lower()
        type_low = entity_type.lower()

        for key, existing in merged_map.items():
            ex_name, ex_type = key.split("::")
            if ex_type == type_low:
                ratio = SequenceMatcher(None, name_low, ex_name).ratio()
                if ratio >= 0.88:
                    return key
        return ""
