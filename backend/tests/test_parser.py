"""
Тесты для Parser Agent
"""

import os
import sys
import pytest
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from agents.parser_agent import ParserAgent
from utils.validators import validate_inn, validate_telegram, validate_email, validate_lead_data


# ── Тесты валидаторов ───────────────────────────────────────

class TestValidators:
    def test_valid_inn_10(self):
        assert validate_inn('1234567890') is True

    def test_valid_inn_12(self):
        assert validate_inn('123456789012') is True

    def test_invalid_inn_short(self):
        assert validate_inn('12345') is False

    def test_invalid_inn_letters(self):
        assert validate_inn('12345abcde') is False

    def test_empty_inn(self):
        assert validate_inn('') is False

    def test_valid_telegram(self):
        assert validate_telegram('@test_seller') is True

    def test_invalid_telegram(self):
        assert validate_telegram('test') is False

    def test_valid_email(self):
        assert validate_email('test@mail.ru') is True

    def test_invalid_email(self):
        assert validate_email('not-an-email') is False


# ── Тесты ParserAgent ───────────────────────────────────────

class TestParserAgent:
    def _create_test_csv(self, content: str) -> str:
        """Создаёт временный CSV файл"""
        tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8')
        tmp.write(content)
        tmp.close()
        return tmp.name

    def test_parse_csv_english_columns(self):
        """Тест парсинга CSV с английскими колонками"""
        csv_content = """brand_name,inn,revenue_monthly,telegram
Тестовый Бренд,1234567890,500000,@test_seller
Бренд 2,9876543210,300000,@seller_two"""
        path = self._create_test_csv(csv_content)

        agent = ParserAgent()
        leads = agent.parse_csv(path)

        assert len(leads) == 2
        assert leads[0]['brand_name'] == 'Тестовый Бренд'
        assert leads[0]['inn'] == '1234567890'
        assert leads[0]['source'] == 'CSV_UPLOAD'
        assert leads[0]['funnel_stage'] == 'PARSED'

        os.unlink(path)

    def test_parse_csv_russian_columns(self):
        """Тест парсинга CSV с русскими колонками"""
        csv_content = """бренд,инн,выручка,телеграм
Мой Бренд,1111111111,200000,@my_brand"""
        path = self._create_test_csv(csv_content)

        agent = ParserAgent()
        leads = agent.parse_csv(path)

        assert len(leads) == 1
        assert leads[0]['brand_name'] == 'Мой Бренд'

        os.unlink(path)

    def test_validate_valid_lead(self):
        """Тест валидации корректного лида"""
        agent = ParserAgent()
        lead = {
            'brand_name': 'Test Brand',
            'inn': '1234567890',
            'telegram': '@test_brand'
        }
        is_valid, error = agent.validate_lead(lead)
        assert is_valid is True
        assert error is None

    def test_validate_missing_inn(self):
        """Тест валидации лида без ИНН"""
        agent = ParserAgent()
        lead = {
            'brand_name': 'Test Brand',
            'telegram': '@test_brand'
        }
        is_valid, error = agent.validate_lead(lead)
        assert is_valid is False
        assert 'inn' in error.lower() or 'инн' in error.lower() or 'ИНН' in error

    def test_validate_no_contacts(self):
        """Тест валидации лида без контактов"""
        agent = ParserAgent()
        lead = {
            'brand_name': 'Test Brand',
            'inn': '1234567890'
        }
        is_valid, error = agent.validate_lead(lead)
        assert is_valid is False
        assert 'контакт' in error.lower()


# Запуск: pytest backend/tests/test_parser.py -v
