export interface KnowledgeBase {
  agency: {
    name: string;
    foundedYear: number;
    experience: string;
  };
  cases: Array<{
    clientName: string;
    before: string;
    after: string;
    result: string;
  }>;
  utp: string[];
  objectionHandlers: Record<string, string>;
}

export const DEFAULT_KNOWLEDGE_BASE: KnowledgeBase = {
  agency: {
    name: 'Antigravity Agency',
    foundedYear: 2023,
    experience: 'Специализируемся на масштабировании продаж на Wildberries. 50+ клиентов, средний рост x3 за 4 месяца.',
  },
  cases: [
    {
      clientName: 'Селлер X — Электроника',
      before: '2M RUB/мес',
      after: '8M RUB/мес',
      result: 'Рост x4 за 5 месяцев через оптимизацию карточек и рекламных кампаний',
    },
    {
      clientName: 'Селлер Y — Одежда',
      before: '500K RUB/мес',
      after: '3M RUB/мес',
      result: 'Рост x6 за 3 месяца благодаря SEO и работе с отзывами',
    },
    {
      clientName: 'Селлер Z — Косметика',
      before: '1.5M RUB/мес',
      after: '7M RUB/мес',
      result: 'Рост x4.5 за 4 месяца через полный аудит и стратегию продвижения',
    },
  ],
  utp: [
    'Гарантия роста оборота на 30% за первые 2 месяца или возврат оплаты',
    'Индивидуальная стратегия для каждого клиента на основе аналитики конкурентов',
    'Полная автоматизация процессов через AI и собственный CRM',
    'Выделенный менеджер + аналитик на каждый проект',
    'Ежедневные отчёты и полная прозрачность результатов',
  ],
  objectionHandlers: {
    'дорого': 'Понимаю ваши сомнения. Давайте я покажу ROI на реальном примере — большинство наших клиентов возвращают инвестиции за 2-3 месяца. Можем созвониться на 15 минут и посчитать конкретно для вашего магазина?',
    'нет времени': 'Как раз поэтому мы берём на себя всю операционку — от аналитики до оптимизации. Вам нужно только 15 минут на Zoom, чтобы мы поняли ваши цели. Когда удобно?',
    'уже работаем с кем-то': 'Отлично, что вы уже инвестируете в развитие! Мы можем сделать аудит текущих результатов бесплатно — покажу, где можно улучшить. Без обязательств.',
    'не интересно': 'Понимаю, не буду настаивать. Могу просто прислать кейс по вашей нише — если будет интересно, напишите. Договорились? 😊',
    'надо подумать': 'Конечно! Пока думаете, посмотрите наш кейс похожего селлера — пришлю в чат. Если появятся вопросы, я на связи.',
  },
};

const STORAGE_PREFIX = 'kb_';

export function getKnowledgeBase(projectId?: string, fallbackName?: string): KnowledgeBase {
  if (projectId) {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as KnowledgeBase;
        return parsed;
      }
    } catch (e) {
      console.warn('[KnowledgeBase] Failed to load custom KB:', e);
    }
  }

  const result = { ...DEFAULT_KNOWLEDGE_BASE };
  if (fallbackName) {
    result.agency = { ...result.agency, name: fallbackName };
  }
  return result;
}

export function saveKnowledgeBase(projectId: string, kb: KnowledgeBase): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(kb));
    console.log(`[KnowledgeBase] Saved KB for project ${projectId}`);
  } catch (e) {
    console.error('[KnowledgeBase] Failed to save KB:', e);
  }
}
