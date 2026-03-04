"""
Parser Agent (Агент 1)
Парсинг и валидация лидов из CSV / Command Center

Субагент 1.1: Search Interface Builder (интеграция с Streamlit/Frontend)
Субагент 1.2: WB Parser Core / CSV Parser
Субагент 1.3: Data Validator & Collector
"""

import os
import sys
import logging
import pandas as pd
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field

# Добавляем корень backend в путь
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from utils.supabase_client import SupabaseClient
from utils.validators import validate_lead_data

logger = logging.getLogger(__name__)


@dataclass
class ParseResult:
    """Результат парсинга"""
    success: bool
    total: int
    inserted: int
    errors: List[str] = field(default_factory=list)
    lead_ids: List[str] = field(default_factory=list)


class ParserAgent:
    """
    Агент 1: Поиск и парсинг лидов

    Функционал:
    - Парсинг CSV/Excel файлов с данными селлеров WB
    - Валидация данных (ИНН, контакты)
    - Проверка дубликатов
    - Сохранение в Supabase со статусом PARSED
    """

    # Маппинг колонок CSV -> внутренние имена
    COLUMN_MAPPING = {
        'бренд': 'brand_name',
        'название': 'brand_name',
        'brand': 'brand_name',
        'инн': 'inn',
        'выручка': 'revenue_monthly',
        'revenue': 'revenue_monthly',
        'категория': 'category',
        'телеграм': 'telegram_username',
        'telegram': 'telegram_username',
        'ватсап': 'phone',
        'whatsapp': 'phone',
        'почта': 'email',
        'регион': 'region',
    }

    def __init__(self, project_id: Optional[str] = None):
        self.supabase = SupabaseClient()
        self.project_id = project_id
        logger.info("ParserAgent инициализирован")

    # ── Субагент 1.1: Search Interface ──────────────────────

    def search_leads(self, brand: Optional[str] = None,
                     category: Optional[str] = None,
                     min_revenue: Optional[int] = None,
                     max_revenue: Optional[int] = None,
                     region: Optional[str] = None) -> List[Dict]:
        """
        Поиск лидов по критериям в БД.
        Используется для интерфейса Command Center.
        """
        query = self.supabase.client.table('sellers').select('*')

        if brand:
            query = query.ilike('brand_name', f'%{brand}%')
        if category:
            query = query.eq('category', category)
        if min_revenue:
            query = query.gte('revenue_monthly', min_revenue)
        if max_revenue:
            query = query.lte('revenue_monthly', max_revenue)
        if self.project_id:
            query = query.eq('project_id', self.project_id)

        response = query.execute()
        return response.data

    # ── Субагент 1.2: CSV Parser ────────────────────────────

    def parse_csv(self, file_path: str) -> List[Dict]:
        """
        Парсинг CSV файла с лидами.
        Поддерживает русские и английские названия колонок.
        """
        try:
            df = pd.read_csv(file_path, encoding='utf-8')
        except UnicodeDecodeError:
            df = pd.read_csv(file_path, encoding='cp1251')

        # Нормализация колонок
        df.columns = [c.strip().lower() for c in df.columns]
        rename_map = {}
        for col in df.columns:
            if col in self.COLUMN_MAPPING:
                rename_map[col] = self.COLUMN_MAPPING[col]
        df = df.rename(columns=rename_map)

        leads = []
        for _, row in df.iterrows():
            lead = {
                'brand_name': str(row.get('brand_name', '')).strip(),
                'inn': str(row.get('inn', '')).strip(),
                'revenue_monthly': self._parse_number(row.get('revenue_monthly')),
                'category': str(row.get('category', '')).strip() or None,
                'telegram_username': str(row.get('telegram_username', '')).strip() or None,
                'phone': str(row.get('phone', '')).strip() or None,
                'email': str(row.get('email', '')).strip() or None,
                'source': 'CSV_UPLOAD',
                'status': 'PARSED',
                'funnel_stage': 'PARSED',
            }
            if self.project_id:
                lead['project_id'] = self.project_id

            leads.append(lead)

        logger.info(f"Спарсено {len(leads)} лидов из CSV")
        return leads

    def parse_excel(self, file_path: str) -> List[Dict]:
        """Парсинг Excel файла"""
        try:
            df = pd.read_excel(file_path)
            # Сохраняем во временный CSV и парсим
            tmp_csv = file_path.replace('.xlsx', '_tmp.csv').replace('.xls', '_tmp.csv')
            df.to_csv(tmp_csv, index=False)
            result = self.parse_csv(tmp_csv)
            os.remove(tmp_csv)
            return result
        except Exception as e:
            raise ValueError(f"Ошибка парсинга Excel: {e}")

    # ── Субагент 1.3: Validator & Collector ─────────────────

    def validate_lead(self, lead: Dict) -> Tuple[bool, Optional[str]]:
        """Валидация данных лида"""
        return validate_lead_data(lead)

    def save_to_database(self, leads: List[Dict]) -> ParseResult:
        """
        Сохранение валидных лидов в Supabase.
        Проверяет дубликаты по ИНН.
        """
        total = len(leads)
        inserted = 0
        errors = []
        lead_ids = []

        for lead in leads:
            brand = lead.get('brand_name', 'Unknown')

            # Валидация
            is_valid, error = self.validate_lead(lead)
            if not is_valid:
                errors.append(f"{brand}: {error}")
                continue

            try:
                # Проверка дубликатов
                if lead.get('inn') and self.supabase.check_duplicate_inn(lead['inn']):
                    errors.append(f"{brand}: Дубликат (ИНН {lead['inn']} уже в БД)")
                    continue

                result = self.supabase.insert_lead(lead)
                lead_ids.append(result['id'])
                inserted += 1
                logger.info(f"Лид сохранён: {brand} (ID: {result['id']})")

            except Exception as e:
                errors.append(f"{brand}: {str(e)}")
                logger.error(f"Ошибка сохранения лида {brand}: {e}")

        return ParseResult(
            success=inserted > 0,
            total=total,
            inserted=inserted,
            errors=errors,
            lead_ids=lead_ids
        )

    # ── Основной метод ──────────────────────────────────────

    def execute(self, csv_path: str) -> ParseResult:
        """
        Основной метод: парсинг файла → валидация → сохранение
        """
        logger.info(f"📥 ParserAgent: начинаю обработку {csv_path}")

        # Определяем тип файла
        if csv_path.endswith(('.xlsx', '.xls')):
            leads = self.parse_excel(csv_path)
        else:
            leads = self.parse_csv(csv_path)

        logger.info(f"✅ Спарсено: {len(leads)} лидов")

        result = self.save_to_database(leads)

        logger.info(f"💾 Сохранено: {result.inserted}/{result.total}")
        if result.errors:
            logger.warning(f"⚠️  Ошибок: {len(result.errors)}")
            for err in result.errors[:5]:
                logger.warning(f"   - {err}")

        return result

    # ── Вспомогательные ─────────────────────────────────────

    @staticmethod
    def _parse_number(value) -> Optional[int]:
        """Безопасный парсинг числа"""
        if pd.isna(value) or value is None:
            return None
        try:
            return int(float(str(value).replace(' ', '').replace(',', '.')))
        except (ValueError, TypeError):
            return None
