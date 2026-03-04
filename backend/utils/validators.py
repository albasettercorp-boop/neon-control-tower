"""
Validators
Валидация данных лидов
"""

import re
from typing import Optional, Tuple


def validate_inn(inn: str) -> bool:
    """
    Валидация ИНН
    10 или 12 цифр
    """
    if not inn:
        return False

    inn = str(inn).strip()

    if not re.match(r'^\d{10}$|^\d{12}$', inn):
        return False

    return True


def validate_telegram(telegram: str) -> bool:
    """
    Валидация Telegram username
    Должен начинаться с @
    """
    if not telegram:
        return False

    telegram = telegram.strip()

    if telegram.startswith('@'):
        return len(telegram) > 1 and bool(re.match(r'^@[a-zA-Z0-9_]{5,32}$', telegram))
    elif 't.me/' in telegram:
        return True

    return False


def validate_email(email: str) -> bool:
    """Валидация email"""
    if not email:
        return False

    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_whatsapp(phone: str) -> bool:
    """
    Валидация WhatsApp номера
    Формат: +7XXXXXXXXXX или просто цифры
    """
    if not phone:
        return False

    phone = re.sub(r'[^\d+]', '', phone)

    if phone.startswith('+'):
        return len(phone) >= 11
    else:
        return len(phone) >= 10


def validate_lead_data(lead: dict) -> Tuple[bool, Optional[str]]:
    """
    Полная валидация данных лида
    Возвращает (is_valid, error_message)
    """

    # Обязательные поля
    required_fields = ['brand_name', 'inn']
    for field in required_fields:
        if not lead.get(field):
            return False, f"Отсутствует обязательное поле: {field}"

    # Валидация ИНН
    if not validate_inn(lead['inn']):
        return False, f"Некорректный ИНН: {lead['inn']}"

    # Хотя бы один контакт
    has_contact = (
        lead.get('telegram') or
        lead.get('whatsapp') or
        lead.get('email')
    )

    if not has_contact:
        return False, "Необходим хотя бы один контакт (telegram/whatsapp/email)"

    # Валидация контактов
    if lead.get('telegram') and not validate_telegram(lead['telegram']):
        return False, f"Некорректный Telegram: {lead['telegram']}"

    if lead.get('email') and not validate_email(lead['email']):
        return False, f"Некорректный email: {lead['email']}"

    if lead.get('whatsapp') and not validate_whatsapp(lead['whatsapp']):
        return False, f"Некорректный WhatsApp: {lead['whatsapp']}"

    return True, None
