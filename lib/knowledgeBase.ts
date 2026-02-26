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
        name: "Antigravity Agency",
        foundedYear: 2021,
        experience: "Более 3 лет работы с селлерами Wildberries. Специализируемся на масштабировании бизнеса через автоматизацию и аналитику."
    },
    cases: [
        {
            clientName: "Селлер X (Электроника)",
            before: "5M RUB/месяц",
            after: "15M RUB/месяц",
            result: "Рост оборота в 3 раза за 4 месяца через оптимизацию рекламы и расширение ассортимента"
        },
        {
            clientName: "Бренд Y (Одежда)",
            before: "2M RUB/месяц",
            after: "8M RUB/месяц",
            result: "Увеличение продаж в 4 раза благодаря A/B тестированию карточек товаров"
        },
        {
            clientName: "Магазин Z (Косметика)",
            before: "3M RUB/месяц",
            after: "12M RUB/месяц",
            result: "Рост на 300% через внедрение системы автоматического ценообразования"
        }
    ],
    utp: [
        "Гарантируем рост оборота минимум на 50% за первые 3 месяца",
        "Полная автоматизация рутинных процессов (парсинг, аналитика, отчёты)",
        "Персональный менеджер и еженедельные созвоны",
        "Работаем только с результатом - оплата за performance",
        "Доступ к закрытой базе знаний и обучающим материалам"
    ],
    objectionHandlers: {
        "дорого": "Понимаю ваше беспокойство. Давайте посчитаем ROI: при обороте 5M и росте на 50% (наш минимум), вы получите дополнительно 2.5M в месяц. Наша комиссия окупится уже в первый месяц.",
        "нет времени": "Именно для этого мы и существуем! Вся рутина автоматизируется. От вас нужно только 1 час в неделю на созвон. Остальное - наша забота.",
        "не уверен": "Абсолютно нормально. Предлагаю начать с бесплатного аудита вашего магазина. Покажем конкретные точки роста, и вы сами решите, стоит ли продолжать.",
        "уже работаю с другим агентством": "Отлично! Значит, вы понимаете ценность профессиональной помощи. Чем именно вы недовольны в текущем сотрудничестве? Возможно, мы сможем закрыть эти пробелы.",
        "сам справлюсь": "Респект! Но вопрос в эффективности. Наши клиенты экономят 20+ часов в неделю на рутине. Это время можно потратить на развитие бизнеса, а не на Excel-таблицы.",
        "не вижу результата": "Справедливо. Поэтому мы работаем прозрачно: еженедельные отчёты, доступ к дашборду в реальном времени, KPI прописаны в договоре. Если не выполним - возврат денег."
    }
};

const STORAGE_PREFIX = 'nct.kb.project.';

function cloneDefaultKnowledgeBase(): KnowledgeBase {
    return JSON.parse(JSON.stringify(DEFAULT_KNOWLEDGE_BASE)) as KnowledgeBase;
}

function sanitizeKnowledgeBase(input: unknown): KnowledgeBase {
    const fallback = cloneDefaultKnowledgeBase();
    if (!input || typeof input !== 'object') {
        return fallback;
    }

    const kb = input as Partial<KnowledgeBase>;
    return {
        agency: {
            name: kb.agency?.name || fallback.agency.name,
            foundedYear: Number(kb.agency?.foundedYear || fallback.agency.foundedYear),
            experience: kb.agency?.experience || fallback.agency.experience,
        },
        cases: Array.isArray(kb.cases) && kb.cases.length > 0
            ? kb.cases.map((item, idx) => ({
                clientName: item?.clientName || `Кейс ${idx + 1}`,
                before: item?.before || '—',
                after: item?.after || '—',
                result: item?.result || 'Результат не указан',
            }))
            : fallback.cases,
        utp: Array.isArray(kb.utp) && kb.utp.length > 0
            ? kb.utp.filter(Boolean)
            : fallback.utp,
        objectionHandlers: kb.objectionHandlers && typeof kb.objectionHandlers === 'object'
            ? { ...fallback.objectionHandlers, ...kb.objectionHandlers }
            : fallback.objectionHandlers,
    };
}

export function getKnowledgeBase(projectId?: string, fallbackName?: string): KnowledgeBase {
    const base = cloneDefaultKnowledgeBase();
    if (fallbackName) {
        base.agency.name = fallbackName;
    }

    if (typeof window === 'undefined' || !projectId) {
        return base;
    }

    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    if (!raw) {
        return base;
    }

    try {
        const parsed = JSON.parse(raw);
        const safeKb = sanitizeKnowledgeBase(parsed);
        if (fallbackName && !safeKb.agency.name) {
            safeKb.agency.name = fallbackName;
        }
        return safeKb;
    } catch {
        return base;
    }
}

export function saveKnowledgeBase(projectId: string, kb: KnowledgeBase): void {
    if (typeof window === 'undefined' || !projectId) {
        return;
    }
    const safeKb = sanitizeKnowledgeBase(kb);
    window.localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(safeKb));
}

export const knowledgeBase: KnowledgeBase = cloneDefaultKnowledgeBase();
