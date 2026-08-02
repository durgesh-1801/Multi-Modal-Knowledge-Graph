"""
Centralized Provider-Independent LLM Abstraction Layer.

Defines `BaseLLMProvider` interface and concrete `GroqProvider` implementation using the official `groq` Python SDK.
All application components depend solely on `BaseLLMProvider`.
"""

from abc import ABC, abstractmethod
import json
import re
import time
from typing import Any, AsyncGenerator, Dict, List, Optional
from pydantic import BaseModel

from app.core.config import settings
from app.core.logging import logger


class LLMResponse(BaseModel):
    """Standardized completion response container across all LLM providers."""
    text: str
    model: str
    provider: str
    latency_ms: float
    raw_response: Optional[Any] = None


class BaseLLMProvider(ABC):
    """
    Abstract Base Class for LLM Provider Adapters (Groq, OpenAI, Anthropic, etc.).
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Returns the provider identifier name (e.g. 'groq')."""
        pass

    @property
    @abstractmethod
    def active_model(self) -> str:
        """Returns the active model name."""
        pass

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        model: Optional[str] = None,
    ) -> LLMResponse:
        """Generates standard text completion."""
        pass

    @abstractmethod
    async def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generates structured JSON response."""
        pass

    @abstractmethod
    async def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        model: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Streams completion tokens."""
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Checks API connection status and returns diagnostic status dict."""
        pass


class GroqProvider(BaseLLMProvider):
    """
    Groq LLM Provider Adapter implementing BaseLLMProvider using official Groq AsyncGroq SDK.
    """

    def __init__(self, api_key: Optional[str] = None, default_model: Optional[str] = None) -> None:
        self.api_key: str = api_key or settings.GROQ_API_KEY or ""
        self._default_model: str = default_model or settings.LLM_MODEL or "llama-3.3-70b-versatile"
        self._client = None

        if self.api_key and self.api_key != "YOUR_GROQ_API_KEY" and self.api_key != "your_groq_api_key_here":
            try:
                from groq import AsyncGroq
                self._client = AsyncGroq(api_key=self.api_key)
                logger.info(f"Initialized GroqProvider with model '{self._default_model}'")
            except Exception as err:
                logger.error(f"Failed to initialize Groq AsyncGroq client: {err}")
        else:
            logger.warning("Groq API key is unconfigured or set to placeholder.")

    @property
    def provider_name(self) -> str:
        return "groq"

    @property
    def active_model(self) -> str:
        return self._default_model

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        model: Optional[str] = None,
    ) -> LLMResponse:
        target_model = model or self._default_model
        start_t = time.time()

        if not self._client:
            logger.warning("Groq client not initialized. Returning empty completion response.")
            return LLMResponse(
                text="",
                model=target_model,
                provider=self.provider_name,
                latency_ms=0.0,
            )

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            chat_completion = await self._client.chat.completions.create(
                messages=messages,
                model=target_model,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            elapsed_ms = (time.time() - start_t) * 1000.0
            content = chat_completion.choices[0].message.content or ""
            return LLMResponse(
                text=content.strip(),
                model=target_model,
                provider=self.provider_name,
                latency_ms=round(elapsed_ms, 2),
                raw_response=chat_completion,
            )
        except Exception as err:
            logger.error(f"Groq Chat Completion error for model '{target_model}': {err}")
            elapsed_ms = (time.time() - start_t) * 1000.0
            return LLMResponse(
                text="",
                model=target_model,
                provider=self.provider_name,
                latency_ms=round(elapsed_ms, 2),
            )

    async def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        target_model = model or self._default_model

        if not self._client:
            logger.warning("Groq client not initialized. Returning empty JSON dict.")
            return {}

        messages = []
        sys_instruct = system_prompt or "You are a JSON assistant. You must reply strictly with valid JSON."
        messages.append({"role": "system", "content": sys_instruct})
        messages.append({"role": "user", "content": prompt})

        try:
            # Request JSON response format from Groq API
            chat_completion = await self._client.chat.completions.create(
                messages=messages,
                model=target_model,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
            )
            raw_text = chat_completion.choices[0].message.content or ""
            return self._clean_and_parse_json(raw_text)

        except Exception as err:
            logger.warning(f"Groq structured JSON mode failed ({err}). Attempting fallback generation & parse.")
            resp = await self.generate(
                prompt=prompt,
                system_prompt=sys_instruct,
                temperature=temperature,
                max_tokens=max_tokens,
                model=target_model,
            )
            return self._clean_and_parse_json(resp.text)

    async def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        model: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        target_model = model or self._default_model

        if not self._client:
            yield "LLM provider offline or API key missing."
            return

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            stream_completion = await self._client.chat.completions.create(
                messages=messages,
                model=target_model,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
            async for chunk in stream_completion:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield delta
        except Exception as err:
            logger.error(f"Groq streaming completion error: {err}")
            yield f"Error: {str(err)}"

    async def health_check(self) -> Dict[str, Any]:
        start_t = time.time()
        if not self._client:
            return {
                "provider": self.provider_name,
                "model": self.active_model,
                "status": "unconfigured",
                "latency_ms": 0.0,
                "detail": "GROQ_API_KEY is not configured.",
            }

        try:
            # Lightweight diagnostic completion
            resp = await self.generate(
                prompt="Respond with 'ok'",
                max_tokens=5,
                temperature=0.0,
            )
            latency = resp.latency_ms
            status_str = "connected" if resp.text else "error"
            return {
                "provider": self.provider_name,
                "model": self.active_model,
                "status": status_str,
                "latency_ms": latency,
            }
        except Exception as err:
            elapsed_ms = (time.time() - start_t) * 1000.0
            return {
                "provider": self.provider_name,
                "model": self.active_model,
                "status": "error",
                "latency_ms": round(elapsed_ms, 2),
                "detail": str(err),
            }

    @staticmethod
    def _clean_and_parse_json(raw_text: str) -> Dict[str, Any]:
        if not raw_text or not raw_text.strip():
            return {}
        clean_json = raw_text.strip()
        if clean_json.startswith("```"):
            clean_json = re.sub(r"^```(?:json)?\n", "", clean_json)
            clean_json = re.sub(r"\n```$", "", clean_json)
        clean_json = clean_json.strip()
        try:
            data = json.loads(clean_json)
            return data if isinstance(data, dict) else {"data": data}
        except Exception as err:
            logger.error(f"JSON parsing error: {err}. Raw text snippet: '{clean_json[:150]}'")
            return {}


class GeminiProvider(BaseLLMProvider):
    """
    Google Gemini LLM Provider Adapter using Google Generative Language REST API.
    """

    def __init__(self, api_key: Optional[str] = None, default_model: Optional[str] = None) -> None:
        self.api_key: str = api_key or getattr(settings, "GEMINI_API_KEY", None) or settings.GROQ_API_KEY or ""
        self._default_model: str = default_model or settings.LLM_MODEL or "gemini-2.5-flash"
        if "llama" in self._default_model.lower():
            self._default_model = "gemini-2.5-flash"

        if self.api_key and not self.api_key.startswith("YOUR_"):
            logger.info(f"Initialized GeminiProvider with model '{self._default_model}'")
        else:
            logger.warning("Gemini API key is unconfigured or set to placeholder.")

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def active_model(self) -> str:
        return self._default_model

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        model: Optional[str] = None,
    ) -> LLMResponse:
        import httpx

        target_model = model or self._default_model
        if "llama" in target_model.lower():
            target_model = "gemini-2.5-flash"

        start_t = time.time()
        if not self.api_key or self.api_key.startswith("YOUR_"):
            return LLMResponse(text="", model=target_model, provider=self.provider_name, latency_ms=0.0)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={self.api_key}"
        contents = []
        if system_prompt:
            contents.append({"role": "user", "parts": [{"text": f"System Instruction: {system_prompt}"}]})
            contents.append({"role": "model", "parts": [{"text": "Understood. I will follow instructions."}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                res = await client.post(url, json=payload)
                res.raise_for_status()
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                elapsed_ms = (time.time() - start_t) * 1000.0
                return LLMResponse(
                    text=text.strip(),
                    model=target_model,
                    provider=self.provider_name,
                    latency_ms=round(elapsed_ms, 2),
                    raw_response=data,
                )
        except Exception as err:
            logger.error(f"Gemini API generation error: {err}")
            elapsed_ms = (time.time() - start_t) * 1000.0
            return LLMResponse(text="", model=target_model, provider=self.provider_name, latency_ms=round(elapsed_ms, 2))

    async def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        sys_instruct = (system_prompt or "") + "\nReturn strictly valid JSON format."
        resp = await self.generate(prompt=prompt, system_prompt=sys_instruct, temperature=temperature, max_tokens=max_tokens, model=model)
        return GroqProvider._clean_and_parse_json(resp.text)

    async def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        model: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        resp = await self.generate(prompt=prompt, system_prompt=system_prompt, temperature=temperature, max_tokens=max_tokens, model=model)
        if resp.text:
            yield resp.text
        else:
            yield "LLM Provider Error or API key unconfigured."

    async def health_check(self) -> Dict[str, Any]:
        resp = await self.generate(prompt="Respond with ok", max_tokens=5, temperature=0.0)
        return {
            "provider": self.provider_name,
            "model": self.active_model,
            "status": "connected" if resp.text else "error",
            "latency_ms": resp.latency_ms,
        }


# ─── Singleton Factory ─────────────────────────────────────────────────────────
_LLM_PROVIDER_INSTANCE: Optional[BaseLLMProvider] = None


def get_llm_provider_instance() -> BaseLLMProvider:
    """
    Retrieves or instantiates the global configured BaseLLMProvider.
    Supports dynamic provider selection based on settings.LLM_PROVIDER.
    """
    global _LLM_PROVIDER_INSTANCE
    if _LLM_PROVIDER_INSTANCE is None:
        provider_type = (settings.LLM_PROVIDER or "gemini").lower()
        if provider_type == "gemini" or getattr(settings, "GEMINI_API_KEY", None):
            _LLM_PROVIDER_INSTANCE = GeminiProvider()
        elif provider_type == "groq":
            _LLM_PROVIDER_INSTANCE = GroqProvider()
        else:
            _LLM_PROVIDER_INSTANCE = GeminiProvider()
    return _LLM_PROVIDER_INSTANCE
