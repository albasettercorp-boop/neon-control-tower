# Backend — Neon Control Tower

Backend система для автоматизации лидогенерации и nurturing для WB-селлеров.

## 🚀 Быстрый старт

### Установка зависимостей

```bash
cd backend
pip install -r requirements.txt
```

### Настройка переменных окружения

```bash
cp .env.example .env
# Заполни реальные значения в .env
```

### Запуск тестов

```bash
# Все тесты
pytest tests/ -v

# Только Parser Agent
pytest tests/test_parser.py -v

# Только Qualification Agent
pytest tests/test_qualification.py -v

# Интеграционный тест
pytest tests/test_integration_12.py -v
```

## 📦 Агенты

### АГЕНТ 1: Parser Agent
**Статус:** ✅ Реализован

Парсинг CSV/Excel файлов с лидами и сохранение в Supabase.

**Использование:**
```python
from agents.parser_agent import ParserAgent

agent = ParserAgent()
result = agent.execute('path/to/leads.csv')

print(f"Сохранено: {result.inserted}/{result.total}")
print(f"ID лидов: {result.lead_ids}")
```

**Формат CSV:**
```csv
brand_name,inn,revenue_monthly,category,telegram,email
Бренд 1,1234567890,500000,Игрушки,@seller1,
Бренд 2,9876543210,300000,Одежда,,seller@mail.ru
```

Поддерживаются как английские, так и русские названия колонок:
`бренд`, `инн`, `выручка`, `категория`, `телеграм`, `ватсап`, `почта`

### АГЕНТ 2: Qualification Agent
**Статус:** ✅ Реализован

AI-анализ лидов, определение "боли" и запись квалификации.

**Использование:**
```python
from agents.qualification_agent import QualificationAgent

agent = QualificationAgent(ai_provider="openai")  # или "anthropic"

# Квалификация одного лида
result = agent.execute(lead_id="uuid-здесь")
print(f"Боль: {result.primary_pain}")
print(f"Описание: {result.pain_description}")
print(f"Приоритет: {result.priority_score}")

# Пакетная квалификация всех PARSED лидов
results = agent.execute_batch(status='PARSED')
```

**Типы болей:**
- `SEO` — проблемы с поиском и карточками
- `Content` — плохой контент, описания, фото
- `Ads` — не используется реклама WB
- `External Traffic` — нет внешнего трафика
- `Pricing` — проблемы с ценообразованием
- `Reviews` — плохие отзывы, низкий рейтинг

## 🧪 Структура

```
backend/
├── agents/
│   ├── parser_agent.py        ✅ Готов
│   ├── qualification_agent.py ✅ Готов
│   ├── hook_agent.py          ⏳ В разработке
│   ├── dialog_agent.py        ⏳ В разработке
│   └── booking_agent.py       ⏳ В разработке
├── utils/
│   ├── supabase_client.py     ✅ Готов
│   ├── ai_client.py           ✅ Готов
│   └── validators.py          ✅ Готов
├── prompts/
│   └── pain_detector.txt      ✅ Готов
├── tests/
│   ├── test_parser.py         ✅ Готов
│   ├── test_qualification.py  ✅ Готов
│   └── test_integration_12.py ✅ Готов
├── config/
│   └── company_config.json    ✅ Готов
├── requirements.txt           ✅ Готов
├── .env.example               ✅ Готов
└── README.md                  ✅ Готов
```

## 📝 Следующие шаги

1. ✅ Parser Agent — ГОТОВ
2. ✅ Qualification Agent — ГОТОВ
3. ⏳ Hook Generator Agent
4. ⏳ Dialog Management Agent
5. ⏳ Booking Approval Agent
6. ⏳ Coordinator (оркестратор)
7. ⏳ E2E тест
