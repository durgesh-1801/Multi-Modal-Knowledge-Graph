"""
spaCy NER Entity Extractor Service.

Provides Stage 1 Named Entity Recognition using spaCy en_core_web_sm model
to extract general entities: PERSON, ORG, DATE, GPE, LOC, PRODUCT, EVENT, MONEY, TIME, NORP.
"""

from typing import Any, List
from app.core.logging import logger
from app.schemas.entity import Entity


class SpacyExtractor:
    """
    Stage 1 Extractor utilizing spaCy NER models for general named entity recognition.
    """

    SPACY_TYPE_MAP = {
        "PERSON": "Employee",
        "ORG": "Organization",
        "DATE": "Date",
        "GPE": "Location",
        "LOC": "Location",
        "PRODUCT": "Technology",
        "EVENT": "Incident",
        "MONEY": "Asset",
        "TIME": "Date",
        "NORP": "Group",
    }

    def __init__(self) -> None:
        self._nlp = None

    def _load_spacy(self) -> Any:
        if self._nlp is None:
            try:
                import spacy

                try:
                    self._nlp = spacy.load("en_core_web_sm")
                    logger.info("Successfully loaded spaCy 'en_core_web_sm' model.")
                except OSError:
                    logger.info("spaCy 'en_core_web_sm' model not found. Automatically downloading model...")
                    try:
                        import spacy.cli
                        spacy.cli.download("en_core_web_sm")
                        self._nlp = spacy.load("en_core_web_sm")
                        logger.info("Successfully downloaded and loaded spaCy 'en_core_web_sm' model.")
                    except Exception as download_err:
                        import sys
                        import subprocess
                        logger.warning(f"spacy.cli download failed ({download_err}). Attempting subprocess download...")
                        subprocess.run(
                            [sys.executable, "-m", "spacy", "download", "en_core_web_sm"],
                            check=True,
                            capture_output=True,
                        )
                        self._nlp = spacy.load("en_core_web_sm")
                        logger.info("Successfully installed and loaded spaCy 'en_core_web_sm' model.")
            except Exception as err:
                logger.error(f"Failed to initialize spaCy NLP engine: {err}")
                self._nlp = "FALLBACK"
        return self._nlp

    def extract(self, text: str) -> List[Entity]:
        """
        Extracts general named entities from text using spaCy NER.

        Args:
            text: Raw input document text.

        Returns:
            List[Entity]: List of extracted entities from spaCy.
        """
        if not text or not text.strip():
            return []

        logger.info("Executing Stage 1: spaCy NER Extraction.")
        nlp = self._load_spacy()
        extracted: List[Entity] = []

        if nlp != "FALLBACK" and hasattr(nlp, "pipe"):
            try:
                # Cap input text to top 100k chars & enable only NER pipe to boost performance
                target_text = text[:100000]
                with nlp.select_pipes(enable=["ner"]):
                    doc = nlp(target_text)
                for ent in doc.ents:
                    entity_type = self.SPACY_TYPE_MAP.get(ent.label_, ent.label_)
                    name = ent.text.strip()

                    # Ignore short noise terms
                    if len(name) > 1:
                        extracted.append(
                            Entity(
                                name=name,
                                type=entity_type,
                                confidence=0.85,
                                source="spaCy",
                                description=f"Extracted via spaCy NER ({ent.label_})",
                                metadata={"spacy_label": ent.label_},
                            )
                        )
                logger.info(f"spaCy NER extracted {len(extracted)} entities.")
            except Exception as err:
                logger.error(f"spaCy extraction error: {err}")

        return extracted
