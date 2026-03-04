"""
Booking Approval Agent (Агент 5)
Формирование заявок на утверждение Zoom-встреч

Субагент 5.1: Time Slot Extractor - извлечение времени из сообщений
Субагент 5.2: Booking Form Generator - создание формы
Субагент 5.3: Dashboard Notification - уведомление менеджера
Субагент 5.4: Manual Approval Handler - обработка утверждения
"""

import os
import sys
import re
import json
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
from dateutil import parser as date_parser

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from utils.supabase_client import SupabaseClient
from utils.ai_client import AIClient

logger = logging.getLogger(__name__)


@dataclass
class BookingForm:
    """Форма бронирования"""
    lead_id: str
    brand_name: str
    contact_person: Optional[str]
    primary_pain: str
    pain_description: str
    conversation_summary: str
    proposed_times: List[str]
    lead_quality_score: float
    revenue_potential: str


class BookingApprovalAgent:
    """
    Агент 5: Управление процессом бронирования Zoom-встреч
    """

    def __init__(self, ai_provider: str = "openai"):
        self.supabase = SupabaseClient()
        self.ai = AIClient(provider=ai_provider)
        logger.info("BookingApprovalAgent инициализирован")

    # ── Субагент 5.1: Time Slot Extractor ──────────────────────

    def extract_time_slots(self, message_text: str) -> List[datetime]:
        """
        Извлечение временных слотов из сообщения лида.
        Поддержка: 'завтра в 15:00', 'послезавтра в 10:00', '15:00'.
        При отсутствии — дефолтные слоты.
        """
        time_slots = []
        text_lower = message_text.lower()

        if 'завтра' in text_lower:
            time_match = re.search(r'(\d{1,2})[:\.]?(\d{2})?', message_text)
            if time_match:
                hour = int(time_match.group(1))
                minute = int(time_match.group(2)) if time_match.group(2) else 0
                tomorrow = datetime.now() + timedelta(days=1)
                slot = tomorrow.replace(hour=hour, minute=minute, second=0, microsecond=0)
                time_slots.append(slot)

        if 'послезавтра' in text_lower:
            time_match = re.search(r'(\d{1,2})[:\.]?(\d{2})?', message_text)
            if time_match:
                hour = int(time_match.group(1))
                minute = int(time_match.group(2)) if time_match.group(2) else 0
                day_after = datetime.now() + timedelta(days=2)
                slot = day_after.replace(hour=hour, minute=minute, second=0, microsecond=0)
                time_slots.append(slot)

        if not time_slots:
            tomorrow_14 = (datetime.now() + timedelta(days=1)).replace(
                hour=14, minute=0, second=0, microsecond=0
            )
            day_after_10 = (datetime.now() + timedelta(days=2)).replace(
                hour=10, minute=0, second=0, microsecond=0
            )
            time_slots = [tomorrow_14, day_after_10]

        return time_slots

    # ── Субагент 5.2: Booking Form Generator ───────────────────

    def generate_booking_form(self, lead_id: str) -> BookingForm:
        """
        Создание структурированной заявки на бронирование.
        Проверяет что лид в статусе READY_FOR_ZOOM.
        """
        lead = self.supabase.get_lead(lead_id)
        if not lead:
            raise ValueError(f"Лид {lead_id} не найден")

        if lead.get('funnel_stage') != 'READY_FOR_ZOOM':
            raise ValueError(
                f"Лид должен быть READY_FOR_ZOOM, текущий: {lead.get('funnel_stage')}"
            )

        conversations = self.supabase.get_conversations(lead_id, limit=20)
        conversation_summary = self._summarize_conversation(conversations)

        last_msg = conversations[-1]['message_text'] if conversations else ""
        proposed_times = self.extract_time_slots(last_msg)

        quality_score = self._calculate_lead_quality(lead, conversations)
        revenue_potential = self._assess_revenue_potential(lead)

        pain_analysis = lead.get('pain_analysis', {})
        if isinstance(pain_analysis, str):
            try:
                pain_analysis = json.loads(pain_analysis)
            except (json.JSONDecodeError, TypeError):
                pain_analysis = {}

        return BookingForm(
            lead_id=lead_id,
            brand_name=lead.get('brand_name', 'Unknown'),
            contact_person=None,
            primary_pain=lead.get('problem_type', 'Unknown'),
            pain_description=pain_analysis.get('pain_description', 'Нет описания'),
            conversation_summary=conversation_summary,
            proposed_times=[t.isoformat() for t in proposed_times],
            lead_quality_score=quality_score,
            revenue_potential=revenue_potential
        )

    def _summarize_conversation(self, conversations: List[Dict]) -> str:
        """AI суммаризация диалога"""
        if not conversations:
            return "Диалог отсутствует"

        history_text = "\n".join([
            f"{'Лид' if msg.get('sender') == 'lead' else 'Мы'}: {msg.get('message_text', '')}"
            for msg in conversations
        ])

        prompt = f"""Ты - аналитик продаж.

Диалог с лидом:
{history_text}

Задача: Создай краткую сводку диалога (2-3 предложения).
Включи: основной интерес лида, ключевые возражения, причину согласия на встречу.
Верни только текст сводки, без JSON."""

        try:
            if self.ai.provider == "openai":
                result = self.ai._call_openai(prompt, "text")
            else:
                result = self.ai._call_anthropic(prompt, "text")
            return result.get('response', 'Не удалось создать сводку')[:300]
        except Exception as e:
            logger.warning(f"Ошибка AI суммаризации: {e}")
            return f"Диалог из {len(conversations)} сообщений. Лид заинтересован."

    def _calculate_lead_quality(self, lead: Dict, conversations: List[Dict]) -> float:
        """Оценка качества лида (0-10)"""
        score = 5.0

        revenue = lead.get('revenue_monthly') or 0
        if revenue > 500000:
            score += 2
        elif revenue > 200000:
            score += 1

        if len(conversations) >= 3:
            score += 1

        lead_msgs = [m for m in conversations if m.get('sender') == 'lead']
        if lead_msgs:
            avg_sentiment = sum(
                m.get('sentiment_score', 0.5) for m in lead_msgs
            ) / len(lead_msgs)
            if avg_sentiment > 0.7:
                score += 1

        if len(conversations) < 5:
            score += 1

        return min(score, 10.0)

    def _assess_revenue_potential(self, lead: Dict) -> str:
        """Оценка потенциала выручки"""
        revenue = lead.get('revenue_monthly') or 0
        if revenue > 500000:
            return 'high'
        elif revenue > 200000:
            return 'medium'
        return 'low'

    # ── Субагент 5.3: Dashboard Notification ───────────────────

    def add_to_approval_queue(self, form: BookingForm) -> Dict:
        """Добавление заявки в очередь на утверждение менеджером"""
        try:
            booking_data = {
                'seller_id': form.lead_id,
                'conversation_summary': form.conversation_summary,
                'proposed_times': form.proposed_times,
                'lead_quality_score': form.lead_quality_score,
                'status': 'pending_approval',
                'created_at': datetime.now().isoformat()
            }

            response = self.supabase.client.table('booking_requests').insert(booking_data).execute()

            if not response.data:
                raise Exception("Не удалось создать заявку в booking_requests")

            booking = response.data[0]
            logger.info(
                f"Заявка создана: ID {booking['id']} | "
                f"{form.brand_name} | Качество: {form.lead_quality_score:.1f}/10"
            )
            return booking

        except Exception as e:
            logger.error(f"Ошибка создания заявки: {e}")
            raise

    # ── Субагент 5.4: Manual Approval Handler ──────────────────

    def approve_booking(self, booking_id: str, confirmed_time: str,
                        approved_by: str = "manager") -> Dict:
        """Утверждение встречи менеджером"""
        try:
            confirmed_dt = date_parser.parse(confirmed_time)

            update_data = {
                'status': 'confirmed',
                'approved_time': confirmed_dt.isoformat(),
                'approved_by': approved_by
            }

            response = (
                self.supabase.client
                .table('booking_requests')
                .update(update_data)
                .eq('id', booking_id)
                .execute()
            )

            if not response.data:
                raise Exception("Не удалось обновить заявку")

            booking = response.data[0]

            self.supabase.update_lead(
                booking['seller_id'],
                {'funnel_stage': 'ZOOM_SCHEDULED'}
            )

            logger.info(
                f"Встреча утверждена: {booking_id} | "
                f"{confirmed_dt.strftime('%d.%m.%Y %H:%M')} | {approved_by}"
            )
            return booking

        except Exception as e:
            logger.error(f"Ошибка утверждения: {e}")
            raise

    # ── Основной метод ─────────────────────────────────────────

    def execute(self, lead_id: str) -> Dict:
        """
        Полный цикл: генерация формы → очередь утверждения
        """
        logger.info(f"📅 BookingApprovalAgent: начинаю обработку лида {lead_id}")

        form = self.generate_booking_form(lead_id)
        logger.info(
            f"Форма: {form.brand_name} | Боль: {form.primary_pain} | "
            f"Качество: {form.lead_quality_score:.1f}/10 | Потенциал: {form.revenue_potential}"
        )

        booking_request = self.add_to_approval_queue(form)

        logger.info(f"✅ BookingApprovalAgent завершён: заявка {booking_request['id']}")
        return booking_request


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Использование: python booking_agent.py <lead_id>")
        sys.exit(1)
    agent = BookingApprovalAgent()
    result = agent.execute(sys.argv[1])
    print(f"\n✅ Заявка создана: {result['id']}")
