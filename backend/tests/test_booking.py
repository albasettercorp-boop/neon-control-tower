"""
Тесты для Booking Approval Agent
"""

import os
import sys
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from agents.booking_agent import BookingApprovalAgent, BookingForm


class TestBookingAgent:

    def _create_agent_with_mocks(self):
        with patch('agents.booking_agent.SupabaseClient') as MockSupa, \
             patch('agents.booking_agent.AIClient') as MockAI:
            agent = BookingApprovalAgent()
            agent.supabase = MockSupa()
            agent.ai = MockAI()
            return agent

    def test_extract_time_slots_tomorrow(self):
        """Тест: 'завтра в 15:00'"""
        agent = self._create_agent_with_mocks()
        slots = agent.extract_time_slots("Давайте созвонимся завтра в 15:00")
        assert len(slots) > 0
        assert slots[0].hour == 15
        assert slots[0].minute == 0

    def test_extract_time_slots_day_after(self):
        """Тест: 'послезавтра в 10:00'"""
        agent = self._create_agent_with_mocks()
        slots = agent.extract_time_slots("Свободен послезавтра в 10:00")
        assert len(slots) > 0
        assert slots[0].hour == 10

    def test_extract_time_slots_default(self):
        """Тест: дефолтные слоты при отсутствии времени"""
        agent = self._create_agent_with_mocks()
        slots = agent.extract_time_slots("Когда-нибудь созвонимся")
        assert len(slots) == 2  # дефолтные: завтра 14:00 и послезавтра 10:00

    def test_generate_booking_form(self):
        """Тест генерации формы бронирования"""
        agent = self._create_agent_with_mocks()

        agent.supabase.get_lead.return_value = {
            'id': 'test-123',
            'brand_name': 'Test Brand',
            'funnel_stage': 'READY_FOR_ZOOM',
            'problem_type': 'SEO',
            'pain_analysis': '{"pain_description": "Низкие позиции"}',
            'revenue_monthly': 500000
        }
        agent.supabase.get_conversations.return_value = [
            {'message_text': 'Привет!', 'sender': 'agent'},
            {'message_text': 'Интересно', 'sender': 'lead', 'sentiment_score': 0.8},
            {'message_text': 'Давайте созвонимся завтра в 15:00', 'sender': 'lead', 'sentiment_score': 0.9}
        ]
        agent.ai._call_openai = Mock(return_value={'response': 'Лид заинтересован'})
        agent.ai.provider = 'openai'

        form = agent.generate_booking_form('test-123')

        assert isinstance(form, BookingForm)
        assert form.lead_id == 'test-123'
        assert form.brand_name == 'Test Brand'
        assert form.primary_pain == 'SEO'
        assert form.lead_quality_score > 0
        assert form.revenue_potential == 'high'

    def test_generate_form_wrong_stage(self):
        """Тест: ошибка если лид не в READY_FOR_ZOOM"""
        agent = self._create_agent_with_mocks()
        agent.supabase.get_lead.return_value = {
            'id': 'test-123',
            'funnel_stage': 'PARSED'
        }

        with pytest.raises(ValueError, match='READY_FOR_ZOOM'):
            agent.generate_booking_form('test-123')

    def test_calculate_lead_quality_high_revenue(self):
        """Тест: высокое качество лида при большой выручке"""
        agent = self._create_agent_with_mocks()
        lead = {'revenue_monthly': 600000}
        convos = [
            {'sender': 'lead', 'sentiment_score': 0.9, 'message_text': 'Интересно'},
            {'sender': 'lead', 'sentiment_score': 0.8, 'message_text': 'Давайте'},
            {'sender': 'lead', 'sentiment_score': 0.85, 'message_text': 'Созвонимся'},
        ]
        score = agent._calculate_lead_quality(lead, convos)
        assert score >= 8.0  # высокая выручка + 3 сообщения + sentiment > 0.7

    def test_assess_revenue_potential(self):
        """Тест оценки потенциала выручки"""
        agent = self._create_agent_with_mocks()
        assert agent._assess_revenue_potential({'revenue_monthly': 600000}) == 'high'
        assert agent._assess_revenue_potential({'revenue_monthly': 300000}) == 'medium'
        assert agent._assess_revenue_potential({'revenue_monthly': 100000}) == 'low'

    def test_add_to_approval_queue(self):
        """Тест добавления в очередь утверждения"""
        agent = self._create_agent_with_mocks()

        mock_response = MagicMock()
        mock_response.data = [{'id': 'booking-uuid', 'status': 'pending_approval'}]
        agent.supabase.client.table.return_value.insert.return_value.execute.return_value = mock_response

        form = BookingForm(
            lead_id='123', brand_name='Test', contact_person=None,
            primary_pain='SEO', pain_description='Test desc',
            conversation_summary='Summary', proposed_times=['2024-01-15T15:00:00'],
            lead_quality_score=8.0, revenue_potential='high'
        )

        result = agent.add_to_approval_queue(form)
        assert result['id'] == 'booking-uuid'
        assert result['status'] == 'pending_approval'


# Запуск: pytest backend/tests/test_booking.py -v
