"""
AI Client
Wrapper для работы с OpenAI/Anthropic API
"""

import os
import json
import logging
from typing import Dict, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class AIClient:
    """Клиент для работы с AI API"""

    VALID_PAIN_TYPES = ['SEO', 'Content', 'Ads', 'External Traffic', 'Pricing', 'Reviews']

    def __init__(self, provider: str = "openai"):
        """
        provider: "openai" или "anthropic"
        """
        self.provider = provider

        if provider == "openai":
            from openai import OpenAI
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY не найден в .env")
            self.client = OpenAI(api_key=api_key)
            self.model = "gpt-4o-mini"

        elif provider == "anthropic":
            from anthropic import Anthropic
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY не найден в .env")
            self.client = Anthropic(api_key=api_key)
            self.model = "claude-3-sonnet-20240229"

    def _call_openai(self, prompt: str, response_format: str = "json") -> Dict:
        """Вызов OpenAI API"""
        messages = [{"role": "user", "content": prompt}]

        kwargs = {"model": self.model, "messages": messages}
        if response_format == "json":
            kwargs["response_format"] = {"type": "json_object"}

        response = self.client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content

        if response_format == "json":
            return json.loads(content)
        return {"response": content}

    def _call_anthropic(self, prompt: str, response_format: str = "json") -> Dict:
        """Вызов Anthropic API"""
        if response_format == "json":
            prompt += "\n\nВерни ответ ТОЛЬКО в формате JSON, без дополнительного текста."

        response = self.client.messages.create(
            model=self.model,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )

        content = response.content[0].text

        if response_format == "json":
            content = content.replace("```json", "").replace("```", "").strip()
            return json.loads(content)

        return {"response": content}

    def analyze_pain_points(self, brand_data: Dict) -> Dict:
        """
        Анализ болей лида.
        Возвращает pain_analysis JSON.
        """
        prompt = f"""Ты - аналитик B2B маркетинга для Wildberries.

Входные данные о бренде:
- Название: {brand_data.get('brand_name', 'Неизвестно')}
- Выручка: {brand_data.get('revenue_monthly', 0)} руб/мес
- Категория: {brand_data.get('category', 'Неизвестно')}
- Позиция в поиске: {brand_data.get('search_position', 'Неизвестно')}
- Средний рейтинг: {brand_data.get('rating', 'Неизвестно')}
- Количество отзывов: {brand_data.get('reviews_count', 'Неизвестно')}

Задача: Определи ТОП-3 проблемы (боли) этого селлера.

Верни JSON:
{{
  "primary_pain": "SEO" | "Content" | "Ads" | "External Traffic" | "Pricing" | "Reviews",
  "pain_description": "Подробное описание главной проблемы (2-3 предложения)",
  "evidence": ["факт 1", "факт 2", "факт 3"],
  "priority_score": 1-10,
  "secondary_pains": ["второстепенная проблема 1", "проблема 2"]
}}"""

        try:
            if self.provider == "openai":
                result = self._call_openai(prompt, "json")
            else:
                result = self._call_anthropic(prompt, "json")

            # Валидация primary_pain
            if result.get('primary_pain') not in self.VALID_PAIN_TYPES:
                logger.warning(f"AI вернул неизвестный тип боли: {result.get('primary_pain')}")
                result['primary_pain'] = 'Content'  # fallback

            return result

        except Exception as e:
            logger.error(f"Ошибка AI анализа: {e}")
            return {
                'primary_pain': 'Content',
                'pain_description': 'Не удалось выполнить AI анализ. Назначен тип по умолчанию.',
                'evidence': [],
                'priority_score': 5,
                'secondary_pains': []
            }
