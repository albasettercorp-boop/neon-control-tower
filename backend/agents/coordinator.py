"""
Coordinator Agent
Главный оркестратор всех 5 агентов системы

Цепочка: CSV → PARSED → QUALIFIED → HOOKS → DIALOGS → READY_FOR_ZOOM → ZOOM_SCHEDULED
"""

import os
import sys
import logging
from typing import Dict, List, Optional
from dataclasses import dataclass

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from agents.parser_agent import ParserAgent
from agents.qualification_agent import QualificationAgent
from agents.hook_agent import HookGeneratorAgent
from agents.dialog_agent import DialogManagementAgent
from agents.booking_agent import BookingApprovalAgent

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class CoordinatorResult:
    """Результат работы координатора"""
    success: bool
    stage: str
    lead_id: Optional[str]
    message: str
    error: Optional[str] = None


class Coordinator:
    """
    Главный координатор системы.
    Управляет всеми 5 агентами и обеспечивает прохождение лидов по воронке.
    """

    def __init__(self, ai_provider: str = "openai"):
        logger.info("Инициализация Coordinator...")

        self.parser = ParserAgent()
        self.qualification = QualificationAgent(ai_provider=ai_provider)
        self.hook_generator = HookGeneratorAgent(ai_provider=ai_provider)
        self.dialog_manager = DialogManagementAgent(ai_provider=ai_provider)
        self.booking = BookingApprovalAgent(ai_provider=ai_provider)

        logger.info("✅ Все 5 агентов инициализированы")

    # ── Этап 1: Парсинг CSV ────────────────────────────────────

    def process_csv(self, csv_path: str) -> CoordinatorResult:
        """Этап 1: Парсинг CSV файла с лидами"""
        try:
            logger.info(f"📥 Этап 1: Парсинг CSV — {csv_path}")
            result = self.parser.execute(csv_path)

            if not result.success:
                return CoordinatorResult(
                    success=False, stage='PARSING', lead_id=None,
                    message=f"Парсинг не удался: {result.errors[:3]}",
                    error=str(result.errors)
                )

            logger.info(f"✅ Сохранено {result.inserted} лидов")
            return CoordinatorResult(
                success=True, stage='PARSED', lead_id=None,
                message=f"Успешно сохранено {result.inserted}/{result.total} лидов"
            )

        except Exception as e:
            logger.error(f"❌ Ошибка парсинга: {e}")
            return CoordinatorResult(
                success=False, stage='PARSING', lead_id=None,
                message="Критическая ошибка парсинга", error=str(e)
            )

    # ── Этап 2: Квалификация ───────────────────────────────────

    def qualify_lead(self, lead_id: str) -> CoordinatorResult:
        """Этап 2: AI-квалификация лида — определение боли"""
        try:
            logger.info(f"🎯 Этап 2: Квалификация — {lead_id}")
            result = self.qualification.execute(lead_id)

            if not result.success:
                return CoordinatorResult(
                    success=False, stage='QUALIFICATION', lead_id=lead_id,
                    message="Квалификация не удалась"
                )

            logger.info(f"✅ Боль определена: {result.primary_pain}")
            return CoordinatorResult(
                success=True, stage='QUALIFIED', lead_id=lead_id,
                message=f"Лид квалифицирован: {result.primary_pain}"
            )

        except Exception as e:
            logger.error(f"❌ Ошибка квалификации: {e}")
            return CoordinatorResult(
                success=False, stage='QUALIFICATION', lead_id=lead_id,
                message="Критическая ошибка квалификации", error=str(e)
            )

    # ── Этап 3: Генерация хука ─────────────────────────────────

    def generate_hook(self, lead_id: str) -> CoordinatorResult:
        """Этап 3: Генерация персонализированного первого сообщения"""
        try:
            logger.info(f"✍️ Этап 3: Генерация хука — {lead_id}")
            hook = self.hook_generator.execute(lead_id)

            logger.info(f"✅ Хук создан, канал: {hook.channel}")
            return CoordinatorResult(
                success=True, stage='HOOKS', lead_id=lead_id,
                message=f"Хук отправлен через {hook.channel}"
            )

        except Exception as e:
            logger.error(f"❌ Ошибка генерации хука: {e}")
            return CoordinatorResult(
                success=False, stage='HOOK_GENERATION', lead_id=lead_id,
                message="Критическая ошибка генерации хука", error=str(e)
            )

    # ── Этап 4: Диалог ─────────────────────────────────────────

    def handle_dialog(self, lead_id: str, message: str, channel: str) -> CoordinatorResult:
        """Этап 4: Обработка входящего сообщения от лида"""
        try:
            logger.info(f"💬 Этап 4: Диалог — {lead_id}")
            request_data = {
                'lead_id': lead_id,
                'message': message,
                'channel': channel
            }

            response = self.dialog_manager.handle_incoming_webhook(request_data)
            logger.info(f"✅ Intent: {response.intent_detected}, Action: {response.next_action}")

            if response.next_action == 'offer_zoom':
                stage = 'READY_FOR_ZOOM'
                msg = "Лид готов к Zoom-звонку!"
            else:
                stage = 'DIALOGS'
                msg = f"Диалог продолжается, intent: {response.intent_detected}"

            return CoordinatorResult(
                success=True, stage=stage, lead_id=lead_id, message=msg
            )

        except Exception as e:
            logger.error(f"❌ Ошибка диалога: {e}")
            return CoordinatorResult(
                success=False, stage='DIALOG', lead_id=lead_id,
                message="Критическая ошибка диалога", error=str(e)
            )

    # ── Этап 5: Бронирование ───────────────────────────────────

    def create_booking_request(self, lead_id: str) -> CoordinatorResult:
        """Этап 5: Создание заявки на бронирование Zoom-встречи"""
        try:
            logger.info(f"📅 Этап 5: Бронирование — {lead_id}")
            booking = self.booking.execute(lead_id)

            logger.info(f"✅ Заявка создана: {booking['id']}")
            return CoordinatorResult(
                success=True, stage='BOOKING_PENDING', lead_id=lead_id,
                message=f"Заявка на утверждение создана: {booking['id']}"
            )

        except Exception as e:
            logger.error(f"❌ Ошибка бронирования: {e}")
            return CoordinatorResult(
                success=False, stage='BOOKING', lead_id=lead_id,
                message="Критическая ошибка бронирования", error=str(e)
            )

    # ── Полный цикл ────────────────────────────────────────────

    def full_cycle(self, csv_path: str, test_lead_index: int = 0) -> Dict:
        """
        Полный цикл обработки лида:
        CSV → PARSED → QUALIFIED → HOOKS → DIALOGS → READY_FOR_ZOOM → BOOKING
        """
        results = {}

        logger.info("🚀 ПОЛНЫЙ ЦИКЛ ОБРАБОТКИ ЛИДА")

        # 1. Парсинг
        result_1 = self.process_csv(csv_path)
        results['parsing'] = result_1
        if not result_1.success:
            return results

        # Получаем ID лида
        from utils.supabase_client import SupabaseClient
        leads = SupabaseClient().get_leads_by_status('PARSED')
        if not leads:
            logger.error("Нет лидов в статусе PARSED")
            return results

        lead_id = leads[test_lead_index]['id']
        logger.info(f"📍 Выбран лид: {lead_id}")

        # 2. Квалификация
        result_2 = self.qualify_lead(lead_id)
        results['qualification'] = result_2
        if not result_2.success:
            return results

        # 3. Хук
        result_3 = self.generate_hook(lead_id)
        results['hook'] = result_3
        if not result_3.success:
            return results

        # 4. Симуляция диалога
        result_4a = self.handle_dialog(lead_id, "Интересно, расскажите подробнее", "telegram")
        results['dialog_1'] = result_4a

        result_4b = self.handle_dialog(lead_id, "Да, давайте созвонимся завтра в 15:00", "telegram")
        results['dialog_2'] = result_4b

        if result_4b.stage != 'READY_FOR_ZOOM':
            logger.warning("Лид не готов к Zoom, пропускаем бронирование")
            return results

        # 5. Бронирование
        result_5 = self.create_booking_request(lead_id)
        results['booking'] = result_5

        logger.info("✅ ПОЛНЫЙ ЦИКЛ ЗАВЕРШЁН УСПЕШНО!")
        return results


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Использование: python coordinator.py <csv_path>")
        sys.exit(1)
    coordinator = Coordinator(ai_provider="openai")
    results = coordinator.full_cycle(sys.argv[1])
    print("\n📊 ИТОГИ:")
    for stage, result in results.items():
        status = "✅" if result.success else "❌"
        print(f"{status} {stage}: {result.message}")
