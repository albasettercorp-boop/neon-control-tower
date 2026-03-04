"""
End-to-End Test
Полная проверка системы: CSV → PARSED → QUALIFIED → HOOKS → DIALOGS → ZOOM_SCHEDULED
"""

import os
import sys
import pytest
import tempfile
from unittest.mock import patch, MagicMock, Mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture
def test_csv():
    """Создание тестового CSV файла"""
    content = """brand_name,inn,revenue_monthly,category,telegram
Test Brand E2E,1234567890,500000,Игрушки,@test_seller
Brand Two,9876543210,300000,Одежда,@seller_two"""
    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8')
    tmp.write(content)
    tmp.close()
    yield tmp.name
    os.unlink(tmp.name)


class TestE2E:

    @patch('agents.booking_agent.SupabaseClient')
    @patch('agents.booking_agent.AIClient')
    @patch('agents.dialog_agent.SupabaseClient')
    @patch('agents.dialog_agent.AIClient')
    @patch('agents.hook_agent.SupabaseClient')
    @patch('agents.hook_agent.AIClient')
    @patch('agents.qualification_agent.SupabaseClient')
    @patch('agents.qualification_agent.AIClient')
    @patch('agents.parser_agent.SupabaseClient')
    @patch('agents.coordinator.SupabaseClient')
    def test_full_e2e_cycle(
        self, MockCoordSupa, MockParserSupa, MockQualAI, MockQualSupa,
        MockHookAI, MockHookSupa, MockDialogAI, MockDialogSupa,
        MockBookAI, MockBookSupa, test_csv
    ):
        """
        Полный E2E тест: CSV → PARSED → QUALIFIED → HOOKS → DIALOGS → ZOOM → BOOKING
        """
        test_lead_id = 'e2e-test-lead-uuid'

        # ── Mock Parser ──
        parser_supa = MockParserSupa.return_value
        parser_supa.check_duplicate_inn.return_value = False
        parser_supa.insert_lead.return_value = {
            'id': test_lead_id, 'brand_name': 'Test Brand E2E', 'funnel_stage': 'PARSED'
        }

        # ── Mock Coordinator Supabase (get_leads_by_status) ──
        coord_supa = MockCoordSupa.return_value
        coord_supa.get_leads_by_status.return_value = [
            {'id': test_lead_id, 'brand_name': 'Test Brand E2E'}
        ]

        # ── Mock Qualification ──
        qual_supa = MockQualSupa.return_value
        qual_supa.get_lead.return_value = {
            'id': test_lead_id, 'brand_name': 'Test Brand E2E',
            'inn': '1234567890', 'revenue_monthly': 500000, 'category': 'Игрушки'
        }
        qual_supa.update_lead.return_value = {'id': test_lead_id}
        qual_ai = MockQualAI.return_value
        qual_ai.analyze_pain_points.return_value = {
            'primary_pain': 'SEO', 'pain_description': 'Низкие позиции в поиске WB',
            'evidence': ['Позиция > 50'], 'priority_score': 8, 'secondary_pains': ['Content']
        }

        # ── Mock Hook ──
        hook_supa = MockHookSupa.return_value
        hook_supa.get_lead.return_value = {
            'id': test_lead_id, 'brand_name': 'Test Brand E2E',
            'problem_type': 'SEO', 'pain_analysis': {'pain_description': 'Низкие позиции'},
            'telegram_username': '@test_seller', 'funnel_stage': 'QUALIFIED'
        }
        hook_supa.update_lead.return_value = {'id': test_lead_id}
        hook_ai = MockHookAI.return_value
        hook_ai.provider = 'openai'
        hook_ai._call_openai = Mock(return_value={
            'hook_text': 'Привет! Заметили что у вас проблемы с SEO на WB?',
            'subject': None, 'expected_response': 'interested'
        })

        # ── Mock Dialog ──
        dialog_supa = MockDialogSupa.return_value
        dialog_supa.get_lead.return_value = {
            'id': test_lead_id, 'brand_name': 'Test Brand E2E',
            'funnel_stage': 'HOOKS'
        }
        dialog_supa.add_conversation_message.return_value = {'id': 'msg-1'}
        dialog_supa.get_conversations.return_value = [
            {'message_text': 'Интересно', 'sender': 'lead', 'timestamp': '2024-01-01T10:00:00Z'}
        ]
        dialog_supa.update_lead.return_value = {'id': test_lead_id}
        dialog_ai = MockDialogAI.return_value
        dialog_ai.provider = 'openai'
        dialog_ai._call_openai = Mock(return_value={
            'intent': 'ready_for_call', 'sentiment_score': 0.9,
            'reasoning': 'Лид готов к звонку',
            'response_text': 'Отлично! Давайте встретимся!',
            'next_action': 'offer_zoom'
        })

        # ── Mock Booking ──
        book_supa = MockBookSupa.return_value
        book_supa.get_lead.return_value = {
            'id': test_lead_id, 'brand_name': 'Test Brand E2E',
            'funnel_stage': 'READY_FOR_ZOOM', 'problem_type': 'SEO',
            'pain_analysis': '{"pain_description": "Низкие позиции"}',
            'revenue_monthly': 500000
        }
        book_supa.get_conversations.return_value = [
            {'message_text': 'Давайте созвонимся завтра в 15:00', 'sender': 'lead', 'sentiment_score': 0.9}
        ]
        book_supa.update_lead.return_value = {'id': test_lead_id}
        book_ai = MockBookAI.return_value
        book_ai.provider = 'openai'
        book_ai._call_openai = Mock(return_value={'response': 'Лид согласился на встречу'})

        mock_booking_resp = MagicMock()
        mock_booking_resp.data = [{'id': 'booking-e2e-uuid', 'status': 'pending_approval', 'seller_id': test_lead_id}]
        book_supa.client.table.return_value.insert.return_value.execute.return_value = mock_booking_resp

        # ══════ ЗАПУСК E2E ══════
        from agents.coordinator import Coordinator
        coordinator = Coordinator(ai_provider="openai")

        # Подменяем supabase на моки внутри каждого агента
        coordinator.parser.supabase = parser_supa
        coordinator.qualification.supabase = qual_supa
        coordinator.qualification.ai = qual_ai
        coordinator.hook_generator.supabase = hook_supa
        coordinator.hook_generator.ai = hook_ai
        coordinator.dialog_manager.supabase = dialog_supa
        coordinator.dialog_manager.ai = dialog_ai
        coordinator.booking.supabase = book_supa
        coordinator.booking.ai = book_ai

        # Мокаем get_leads_by_status в full_cycle
        with patch('agents.coordinator.SupabaseClient') as MockInnerSupa:
            MockInnerSupa.return_value.get_leads_by_status.return_value = [
                {'id': test_lead_id, 'brand_name': 'Test Brand E2E'}
            ]
            results = coordinator.full_cycle(test_csv, test_lead_index=0)

        # ══════ ПРОВЕРКИ ══════
        assert 'parsing' in results
        assert results['parsing'].success is True
        assert results['parsing'].stage == 'PARSED'

        assert 'qualification' in results
        assert results['qualification'].success is True
        assert results['qualification'].stage == 'QUALIFIED'

        assert 'hook' in results
        assert results['hook'].success is True
        assert results['hook'].stage == 'HOOKS'

        assert 'dialog_1' in results
        assert results['dialog_1'].success is True

        assert 'dialog_2' in results
        assert results['dialog_2'].success is True
        assert results['dialog_2'].stage == 'READY_FOR_ZOOM'

        assert 'booking' in results
        assert results['booking'].success is True
        assert results['booking'].stage == 'BOOKING_PENDING'


# Запуск: pytest backend/tests/test_e2e.py -v -s
