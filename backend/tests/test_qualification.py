"""
Тесты для Qualification Agent
"""

import os
import sys
import json
import pytest
from unittest.mock import Mock, patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from agents.qualification_agent import QualificationAgent


class TestQualificationAgent:

    def _create_agent_with_mocks(self):
        """Создаёт агент с замоканными зависимостями"""
        with patch('agents.qualification_agent.SupabaseClient') as MockSupa, \
             patch('agents.qualification_agent.AIClient') as MockAI:
            agent = QualificationAgent()
            agent.supabase = MockSupa()
            agent.ai = MockAI()
            return agent

    def test_enrich_lead_data(self):
        """Тест обогащения данных лида"""
        agent = self._create_agent_with_mocks()
        agent.supabase.get_lead.return_value = {
            'id': 'test-uuid-123',
            'brand_name': 'Test Brand',
            'inn': '1234567890',
            'revenue_monthly': 500000,
            'category': 'Игрушки'
        }

        enriched = agent.enrich_lead_data('test-uuid-123')

        assert enriched['brand_name'] == 'Test Brand'
        assert 'search_position' in enriched
        assert 'rating' in enriched
        assert 'reviews_count' in enriched
        agent.supabase.get_lead.assert_called_once_with('test-uuid-123')

    def test_enrich_lead_not_found(self):
        """Тест обогащения — лид не найден"""
        agent = self._create_agent_with_mocks()
        agent.supabase.get_lead.return_value = None

        with pytest.raises(ValueError, match='не найден'):
            agent.enrich_lead_data('nonexistent-id')

    def test_detect_pain_points(self):
        """Тест AI-анализа болей (с mock ответом)"""
        agent = self._create_agent_with_mocks()
        agent.ai.analyze_pain_points.return_value = {
            'primary_pain': 'SEO',
            'pain_description': 'Низкие позиции в поиске WB, карточки не оптимизированы',
            'evidence': ['Позиция > 50', 'Мало ключевых слов', 'Короткое описание'],
            'priority_score': 8,
            'secondary_pains': ['Content', 'Reviews']
        }

        lead_data = {'brand_name': 'Test', 'revenue_monthly': 500000, 'category': 'Игрушки'}
        pain_data = agent.detect_pain_points(lead_data)

        assert pain_data['primary_pain'] == 'SEO'
        assert pain_data['priority_score'] == 8
        assert len(pain_data['evidence']) >= 2
        assert pain_data['primary_pain'] in agent.VALID_PAIN_TYPES

    def test_detect_pain_points_invalid_type_fallback(self):
        """Тест фоллбэка при неизвестном типе боли"""
        agent = self._create_agent_with_mocks()
        agent.ai.analyze_pain_points.return_value = {
            'primary_pain': 'UnknownType',
            'pain_description': 'Что-то непонятное',
            'evidence': [],
            'priority_score': 'not_a_number',
            'secondary_pains': []
        }

        pain_data = agent.detect_pain_points({})

        assert pain_data['primary_pain'] == 'Content'  # fallback
        assert pain_data['priority_score'] == 5         # fallback

    def test_update_qualification(self):
        """Тест обновления квалификации в БД"""
        agent = self._create_agent_with_mocks()
        agent.supabase.update_lead.return_value = {'id': 'test-uuid-123'}

        pain_data = {
            'primary_pain': 'SEO',
            'pain_description': 'Тест',
            'evidence': [],
            'priority_score': 7,
            'secondary_pains': []
        }

        success = agent.update_qualification('test-uuid-123', pain_data)

        assert success is True
        agent.supabase.update_lead.assert_called_once()
        call_args = agent.supabase.update_lead.call_args
        assert call_args[0][0] == 'test-uuid-123'
        assert call_args[0][1]['funnel_stage'] == 'QUALIFIED'
        assert call_args[0][1]['problem_type'] == 'SEO'

    def test_execute_full_cycle(self):
        """Тест полного цикла квалификации"""
        agent = self._create_agent_with_mocks()

        # Mock get_lead
        agent.supabase.get_lead.return_value = {
            'id': 'test-uuid-123',
            'brand_name': 'Full Cycle Brand',
            'inn': '1234567890',
            'revenue_monthly': 600000,
            'category': 'Электроника'
        }

        # Mock AI
        agent.ai.analyze_pain_points.return_value = {
            'primary_pain': 'Ads',
            'pain_description': 'Бренд не использует рекламу внутри WB',
            'evidence': ['Нет рекламных кампаний', 'Низкий трафик'],
            'priority_score': 9,
            'secondary_pains': ['External Traffic']
        }

        # Mock update
        agent.supabase.update_lead.return_value = {'id': 'test-uuid-123'}

        result = agent.execute('test-uuid-123')

        assert result.success is True
        assert result.primary_pain == 'Ads'
        assert result.priority_score == 9
        assert result.lead_id == 'test-uuid-123'


# Запуск: pytest backend/tests/test_qualification.py -v
