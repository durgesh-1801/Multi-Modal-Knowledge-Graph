"""
Gemini Domain Entity Extractor Service.

Provides Stage 3 domain-specific compliance entity extraction using Google Gemini API.
Identifies Business Risks, Compliance Controls, Policy Statements, Security Requirements,
Audit Findings, and Mitigation Measures.
"""

import json
import re
from typing import Any, Dict, List
import httpx

from app.core.config import settings
from app.core.logging import logger
from app.prompts.entity_prompt import build_entity_prompt
from app.schemas.entity import Entity


class GeminiExtractor:
    """
    Stage 3 Extractor leveraging Gemini generative LLM for high-precision compliance entity extractions.
    """

    def __init__(self, api_key: str = None) -> None:
        self.api_key: str = api_key or settings.GEMINI_API_KEY

    async def extract_async(self, text: str) -> List[Entity]:
        """
        Asynchronously invokes Gemini API to extract compliance entities.

        Args:
            text: Raw input document text.

        Returns:
            List[Entity]: Extracted entities from Gemini LLM.
        """
        if not text or not text.strip():
            return []

        if not self.api_key or self.api_key == "your-gemini-api-key-here":
            logger.warning(
                "Gemini API key is not configured. Skipping Stage 3 Gemini extraction."
            )
            return []

        logger.info("Executing Stage 3: Gemini LLM Domain Entity Extraction.")
        prompt_text = build_entity_prompt(text[:8000])  # Truncate long prompts if necessary

        extracted_entities: List[Entity] = []

        try:
            # 1. Attempt using google.generativeai SDK if available
            import google.generativeai as genai

            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt_text)
            raw_response_text = response.text if response else ""
            extracted_entities = self._parse_gemini_json_response(raw_response_text)

        except Exception as sdk_err:
            logger.warning(f"Generative AI SDK call failed ({sdk_err}). Attempting direct REST HTTP API call.")
            # 2. Fallback to direct HTTP REST call
            extracted_entities = await self._call_gemini_rest_api(prompt_text)

        logger.info(f"Gemini LLM extracted {len(extracted_entities)} domain entities.")
        return extracted_entities

    def extract_sync(self, text: str) -> List[Entity]:
        """Synchronous wrapper for extract_async."""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If already in an async event loop, run in executor
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(asyncio.run, self.extract_async(text)).result()
            return loop.run_until_complete(self.extract_async(text))
        except Exception:
            return asyncio.run(self.extract_async(text))

    async def _call_gemini_rest_api(self, prompt: str) -> List[Entity]:
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

    def _parse_gemini_json_response(self, raw_text: str) -> List[Entity]:
        """Parses raw text returned by Gemini into a list of Entity objects."""
        if not raw_text:
            return []

        # Strip markdown code fences if present
        clean_json = raw_text.strip()
        if clean_json.startswith("```"):
            clean_json = re.sub(r"^```(?:json)?\n", "", clean_json)
            clean_json = re.sub(r"\n```$", "", clean_json)
        clean_json = clean_json.strip()

        entities: List[Entity] = []
        try:
            parsed = json.loads(clean_json)
            raw_list = parsed.get("entities", []) if isinstance(parsed, dict) else parsed

            if isinstance(raw_list, list):
                for item in raw_list:
                    if isinstance(item, dict) and "name" in item and "type" in item:
                        name = str(item["name"]).strip()
                        ent_type = str(item["type"]).strip()
                        conf = float(item.get("confidence", 0.95))
                        desc = str(item.get("description", "")).strip()

                        if name:
                            entities.append(
                                Entity(
                                    name=name,
                                    type=ent_type,
                                    confidence=round(conf, 4),
                                    source="Gemini",
                                    description=desc,
                                    metadata={"llm_model": "gemini-1.5-flash"},
                                )
                            )
        except Exception as json_err:
            logger.error(f"Failed to parse Gemini JSON output: {json_err}. Raw text: '{raw_text[:200]}'")
        return entities
