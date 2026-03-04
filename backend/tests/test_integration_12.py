"""
Интеграционный тест агентов 1-2
Полный цикл: CSV → Parser → PARSED → Qualification → QUALIFIED
"""

import os
import sys
import tempfile
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from agents.parser_agent import ParserAgent
from agents.qualification_agent import QualificationAgent


class TestIntegration12:
    """Интеграционный тест: Parser → Qualification"""

    def _create_test_csv(self) -> str:
        content = """brand_name,inn,revenue_monthly,category,telegram
Тестовый Бренд Интеграция,1234567890,500000,Игрушки,@test_integr"""
        tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8')
        tmp.write(content)
        tmp.close()
        return tmp.name

    @patch('agents.qualification_agent.AIClient')
    @patch('agents.qualification_agent.SupabaseClient')
    @patch('agents.parser_agent.SupabaseClient')
    def test_full_pipeline(self, MockParserSupa, MockQualSupa, MockAI):
        """
        Полный цикл:
        1. CSV → ParserAgent → лид в БД (PARSED)
        2. QualificationAgent → AI анализ → лид обновлён (QUALIFIED)
        """
        test_lead_id = 'integration-test-uuid'

        # --- Mock Parser Supabase ---
        parser_supa = MockParserSupa()
        parser_supa.check_duplicate_inn.return_value = False
        parser_supa.insert_lead.return_value = {
            'id': test_lead_id,
            'brand_name': 'Тестовый Бренд Интеграция',
            'funnel_stage': 'PARSED'
        }

        # --- Mock Qualification Supabase ---
        qual_supa = MockQualSupa()
        qual_supa.get_lead.return_value = {
            'id': test_lead_id,
            'brand_name': 'Тестовый Бренд Интеграция',
            'inn': '1234567890',
            'revenue_monthly': 500000,
            'category': 'Игрушки',
            'funnel_stage': 'PARSED'
        }
        qual_supa.update_lead.return_value = {'id': test_lead_id}

        # --- Mock AI ---
        ai_instance = MockAI()
        ai_instance.analyze_pain_points.return_value = {
            'primary_pain': 'SEO',
            'pain_description': 'Низкие позиции в поиске, карточки не оптимизированы',
            'evidence': ['Позиция > 100', 'Мало ключей', 'Без A+ контента'],
            'priority_score': 8,
            'secondary_pains': ['Content', 'Ads']
        }

        # ═══ ШАГ 1: Parser Agent ═══
        csv_path = self._create_test_csv()
        parser = ParserAgent()
        parser.supabase = parser_supa

        parse_result = parser.execute(csv_path)

        assert parse_result.success is True
        assert parse_result.inserted == 1
        assert parse_result.total == 1
        assert test_lead_id in parse_result.lead_ids

        # Проверяем что лид записан со статусом PARSED
        insert_call = parser_supa.insert_lead.call_args[0][0]
        assert insert_call['funnel_stage'] == 'PARSED'
        assert insert_call['source'] == 'CSV_UPLOAD'

        # ═══ ШАГ 2: Qualification Agent ═══
        qual_agent = QualificationAgent()
        qual_agent.supabase = qual_supa
        qual_agent.ai = ai_instance

        qual_result = qual_agent.execute(test_lead_id)

        assert qual_result.success is True
        assert qual_result.primary_pain == 'SEO'
        assert qual_result.priority_score == 8
        assert qual_result.lead_id == test_lead_id

        # Проверяем что лид обновлён → QUALIFIED
        update_call = qual_supa.update_lead.call_args[0]
        assert update_call[0] == test_lead_id
        assert update_call[1]['funnel_stage'] == 'QUALIFIED'
        assert update_call[1]['problem_type'] == 'SEO'

        # Cleanup
        os.unlink(csv_path)

        print("\n✅ Интеграционный тест Parser → Qualification ПРОШЁЛ!")


# Запуск: pytest backend/tests/test_integration_12.py -v
