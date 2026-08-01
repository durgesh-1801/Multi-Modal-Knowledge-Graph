"""
Gemini Relationship Extractor Service.

Provides Stage 2 semantic relationship extraction using Google Gemini API.
Infers policy responsibilities, compliance dependencies, risk mitigations,
and department ownerships from text and entity context.
"""

import json
import re
from typing import List
import httpx

from app.core.config import settings
from app.core.logging import logger
from app.prompts.relationship_prompt import build_relationship_prompt
from app.schemas.entity import Entity
from app.schemas.relationship import Relationship


class GeminiRelationshipExtractor:
    """
    Stage 2 Relationship Extractor leveraging Gemini LLM for complex semantic link extractions.
    """

    def __init__(self, api_key: str = None) -> None:
        self.api_key: str = api_key or settings.GEMINI_API_KEY

    async def extract_async(self, text: str, entities: List[Entity]) -> List[Relationship]:
        """
        Asynchronously invokes Gemini API to extract relationships between entities.

        Args:
            text: Input document text.
            entities: Known extracted entities list.

        Returns:
            List[Relationship]: Extracted semantic relationships.
        """
        if not text or not text.strip():
            return []

        if not self.api_key or self.api_key == "your-gemini-api-key-here":
            logger.warning(
                "Gemini API key is not configured. Skipping Gemini relationship extraction."
            )
            return []

        logger.info("Executing Stage 2: Gemini LLM Relationship Extraction.")

        # Format entity summary for prompt context
        ent_summary = ", ".join([f"{e.name} ({e.type})" for e in entities[:25]])
        prompt_text = build_relationship_prompt(text[:8000], ent_summary)

        relationships: List[Relationship] = []

        try:
            # 1. Attempt using google.generativeai SDK if available
            import google.generativeai as genai

            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt_text)
            raw_response_text = response.text if response else ""
            relationships = self._parse_gemini_json_response(raw_response_text)

        except Exception as sdk_err:
            logger.warning(
                f"Generative AI SDK relationship call failed ({sdk_err}). Attempting direct HTTP API call."
            )
            relationships = await self._call_gemini_rest_api(prompt_text)

        logger.info(f"Gemini LLM extracted {len(relationships)} semantic relationships.")
        return relationships

    async def _call_gemini_rest_api(self, prompt: str) -> List[Relationship]:
        """Calls Gemini v1beta REST API directly via HTTPX."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
        }
        headers = {"Content-Type": "application/json"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            raw_text = parts[0].get("text", "")
                            return self._parse_gemini_json_response(raw_text)
                else:
                    logger.error(f"Gemini REST API error {resp.status_code}: {resp.text}")
        except Exception as err:
            logger.error(f"Gemini REST API exception: {err}")
        return []

    def _parse_gemini_json_response(self, raw_text: str) -> List[Relationship]:
        """Parses raw text returned by Gemini into a list of Relationship objects."""
        if not raw_text:
            return []

        clean_json = raw_text.strip()
        if clean_json.startswith("```"):
            clean_json = re.sub(r"^```(?:json)?\n", "", clean_json)
            clean_json = re.sub(r"\n```$", "", clean_json)
        clean_json = clean_json.strip()

        relationships: List[Relationship] = []
        try:
            parsed = json.loads(clean_json)
            raw_list = parsed.get("relationships", []) if isinstance(parsed, dict) else parsed

            if isinstance(raw_list, list):
                for item in raw_list:
                    if isinstance(item, dict) and "source" in item and "target" in item and "relation" in item:
                        src = str(item["source"]).strip()
                        tgt = str(item["target"]).strip()
                        rel = str(item["relation"]).strip()
                        conf = float(item.get("confidence", 0.95))
                        reason_str = str(item.get("reason", "")).strip()

                        if src and tgt and rel:
                            relationships.append(
                                Relationship(
                                    source=src,
                                    target=tgt,
                                    relation=rel,
                                    confidence=round(conf, 4),
                                    source_engine="Gemini",
                                    reason=reason_str if reason_str else None,
                                    metadata={"llm_model": "gemini-1.5-flash"},
                                )
                            )
        except Exception as json_err:
            logger.error(
                f"Failed to parse Gemini relationship JSON output: {json_err}. Raw text: '{raw_text[:200]}'"
            )
        return relationships
