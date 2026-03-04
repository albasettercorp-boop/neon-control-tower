"""
Qualification Agent (Агент 2)
Квалификация лидов и определение "боли" через AI

Субагент 2.1: Data Enrichment
Субагент 2.2: Pain Point Detector (AI)
Субагент 2.3: Database Updater
"""

import os
import sys
import json
import logging
from typing import Dict, List, Optional
from dataclasses import dataclass

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from utils.supabase_client import SupabaseClient
from utils.ai_client import AIClient

logger = logging.getLogger(__name__)


@dataclass
class QualificationResult:
    """Результат квалификации"""
    success: bool
    lead_id: str
    primary_pain: str
    pain_description: str
    priority_score: int
    secondary_pains: List[str]


class QualificationAgent:
    """
    Агент 2: Квалификация лидов

    Функционал:
    - Обогащение данных о лиде
    - AI-анализ болей (Pain Point Detector)
    - Обновление записи в БД со статусом QUALIFIED
    """

    VALID_PAIN_TYPES = ['SEO', 'Content', 'Ads', 'External Traffic', 'Pricing', 'Reviews']

    def __init__(self, ai_provider: str = "openai"):
        self.supabase = SupabaseClient()
        self.ai = AIClient(provider=ai_provider)
        logger.info(f"QualificationAgent инициализирован (AI: {ai_provider})")

    # ── Субагент 2.1: Data Enrichment ───────────────────────

    def enrich_lead_data(self, lead_id: str) -> Dict:
        """
        Обогащение данных о лиде.
        В MVP: данные из БД + плейсхолдеры для WB-данных.
        В полной версии: парсинг WB, соц.сетей, конкурентов.
        """
        lead = self.supabase.get_lead(lead_id)

        if not lead:
            raise ValueError(f"Лид {lead_id} не найден в БД")

        enriched = {
            **lead,
            'search_position': lead.get('search_position'),
            'rating': lead.get('rating'),
            'reviews_count': lead.get('reviews_count'),
            'competitors_count': None,  # TODO: парсинг конкурентов
        }

        logger.info(f"Данные лида {lead_id} обогащены")
        return enriched

    # ── Субагент 2.2: Pain Point Detector (AI) ──────────────

    def detect_pain_points(self, enriched_data: Dict) -> Dict:
        """
        Определение болей через AI.
        Использует промпт из спецификации.
        Возвращает JSON с pain_analysis.
        """
        pain_analysis = self.ai.analyze_pain_points(enriched_data)

        # Валидация результата
        if pain_analysis.get('primary_pain') not in self.VALID_PAIN_TYPES:
            logger.warning(
                f"AI вернул неизвестный тип: {pain_analysis.get('primary_pain')}. "
                f"Устанавливаю 'Content' по умолчанию."
            )
            pain_analysis['primary_pain'] = 'Content'

        if not isinstance(pain_analysis.get('evidence'), list):
            pain_analysis['evidence'] = []

        if not isinstance(pain_analysis.get('priority_score'), (int, float)):
            pain_analysis['priority_score'] = 5

        logger.info(
            f"AI анализ: primary_pain={pain_analysis['primary_pain']}, "
            f"score={pain_analysis['priority_score']}"
        )
        return pain_analysis

    # ── Субагент 2.3: Database Updater ──────────────────────

    def update_qualification(self, lead_id: str, pain_data: Dict) -> bool:
        """
        Обновление данных квалификации в БД.
        Устанавливает problem_type, pain_analysis (JSONB), funnel_stage=QUALIFIED.
        """
        try:
            update_data = {
                'problem_type': pain_data['primary_pain'],
                'pain_analysis': json.dumps(pain_data, ensure_ascii=False),
                'funnel_stage': 'QUALIFIED',
                'status': 'QUALIFIED',
            }

            self.supabase.update_lead(lead_id, update_data)
            logger.info(f"Лид {lead_id} обновлён → QUALIFIED (боль: {pain_data['primary_pain']})")
            return True

        except Exception as e:
            logger.error(f"Ошибка обновления лида {lead_id}: {e}")
            return False

    # ── Основной метод ──────────────────────────────────────

    def execute(self, lead_id: str) -> QualificationResult:
        """
        Полный цикл квалификации одного лида:
        1. Enrichment
        2. AI Pain Point Detection
        3. DB Update
        """
        logger.info(f"🔍 QualificationAgent: начинаю квалификацию лида {lead_id}")

        # 1. Enrichment
        enriched = self.enrich_lead_data(lead_id)
        logger.info("✅ Данные обогащены")

        # 2. AI-анализ
        pain_data = self.detect_pain_points(enriched)
        logger.info(f"🧠 AI определил боль: {pain_data['primary_pain']}")

        # 3. Обновление БД
        success = self.update_qualification(lead_id, pain_data)
        if success:
            logger.info("💾 Лид обновлён, статус: QUALIFIED")

        return QualificationResult(
            success=success,
            lead_id=lead_id,
            primary_pain=pain_data['primary_pain'],
            pain_description=pain_data.get('pain_description', ''),
            priority_score=pain_data.get('priority_score', 5),
            secondary_pains=pain_data.get('secondary_pains', [])
        )

    def execute_batch(self, status: str = 'PARSED') -> List[QualificationResult]:
        """
        Пакетная квалификация всех лидов с указанным статусом.
        """
        leads = self.supabase.get_leads_by_status(status)
        logger.info(f"Найдено {len(leads)} лидов со статусом {status}")

        results = []
        for lead in leads:
            try:
                result = self.execute(lead['id'])
                results.append(result)
            except Exception as e:
                logger.error(f"Ошибка квалификации лида {lead['id']}: {e}")

        qualified = sum(1 for r in results if r.success)
        logger.info(f"Квалифицировано: {qualified}/{len(leads)}")
        return results
