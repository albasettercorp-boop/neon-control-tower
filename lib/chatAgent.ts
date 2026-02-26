import { getKnowledgeBase } from './knowledgeBase';

const GEMINI_API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export interface LeadContext {
    id?: string;
    projectId?: string;
    clientCompanyName?: string;
    name: string;
    brandName?: string;
    revenue?: number;
    painPoints?: string[];
    source?: string;
    topProduct?: string;
}

interface Message {
    role: 'user' | 'agent';
    content: string;
    timestamp: Date;
}

const PAIN_KEYWORDS: Array<{ tag: string; pattern: RegExp }> = [
    { tag: 'low_rating', pattern: /(рейтинг|оценк|звезд|зв[её]зд)/i },
    { tag: 'stock_issues', pattern: /(сток|остатк|законч|нет в наличии|склад)/i },
    { tag: 'low_trust', pattern: /(отзыв|довер|мало комментар|репутац)/i },
    { tag: 'high_returns', pattern: /(возврат|возвраты|refund)/i },
    { tag: 'poor_seo', pattern: /(seo|поиск|карточк|видимост|позици)/i },
];

export function inferPainPointsFromText(content: string): string[] {
    if (!content) return [];
    const points: string[] = [];
    for (const rule of PAIN_KEYWORDS) {
        if (rule.pattern.test(content)) {
            points.push(rule.tag);
        }
    }
    return [...new Set(points)];
}

function formatRevenue(revenue?: number): string {
    if (!revenue) return 'не указана';
    if (revenue >= 1_000_000) return `${(revenue / 1_000_000).toFixed(1)}M руб/мес`;
    if (revenue >= 1_000) return `${(revenue / 1_000).toFixed(0)}K руб/мес`;
    return `${revenue} руб/мес`;
}

function formatPainPoints(points?: string[]): string {
    if (!points || points.length === 0) return 'нет данных';
    const translations: Record<string, string> = {
        low_rating: 'низкий рейтинг товаров',
        stock_issues: 'проблемы с остатками/стоки',
        low_trust: 'мало отзывов, низкое доверие',
        high_returns: 'высокий процент возвратов',
        poor_seo: 'плохие позиции в поиске WB',
    };
    return points.map((p) => translations[p] || p).join(', ');
}

function buildSystemPrompt(lead: LeadContext): string {
    const knowledgeBase = getKnowledgeBase(lead.projectId, lead.clientCompanyName);
    const cases = knowledgeBase.cases
        .map((c) => `- ${c.clientName}: ${c.before} → ${c.after}. ${c.result}`)
        .join('\n');

    const utpList = knowledgeBase.utp.map((u, i) => `${i + 1}. ${u}`).join('\n');

    const objections = Object.entries(knowledgeBase.objectionHandlers)
        .map(([obj, resp]) => `"${obj}": ${resp}`)
        .join('\n\n');

    const painSummary = formatPainPoints(lead.painPoints);
    const revenueSummary = formatRevenue(lead.revenue);

return `Ты — менеджер по продажам агентства ${knowledgeBase.agency.name}.
${knowledgeBase.agency.experience}

=== ДАННЫЕ ЭТОГО КЛИЕНТА ===
Имя / Бренд: ${lead.brandName || lead.name}
Выручка WB: ${revenueSummary}
Боли/проблемы: ${painSummary}
Топ-продукт: ${lead.topProduct || 'не указан'}
Источник лида: ${lead.source || 'Wildberries'}

=== ТВОИ КЕЙСЫ (ИСПОЛЬЗУЙ ДЛЯ АРГУМЕНТАЦИИ) ===
${cases}

=== УНИКАЛЬНОЕ ТОРГОВОЕ ПРЕДЛОЖЕНИЕ ===
${utpList}

=== ОБРАБОТКА ВОЗРАЖЕНИЙ ===
${objections}

=== ЦЕЛЬ ДИАЛОГА ===
Записать клиента на ZOOM-созвон. Стратегия:
1. Сначала выяви боль — задай 1 уточняющий вопрос про их ситуацию на WB
2. На основе болей — покажи релевантный кейс ("У похожего клиента мы подняли X...")
3. Предложи БЕСПЛАТНЫЙ аудит или Zoom (это бесплатно для них, без обязательств)
4. Если согласился → скажи "Отлично! Когда вам удобно — утро или вечер?" и заверши

=== ПРАВИЛА ===
- Пиши КОРОТКО (1-3 предложения)
- Используй конкретные цифры из кейсов
- Упоминай боль клиента по имени (${lead.brandName || lead.name})
- НЕ будь навязчивым  
- Если клиент явно отказывает 2 раза — вежливо предложи вернуться позже
- Умеренно используй эмодзи
- Ты всегда выступаешь от лица компании ${knowledgeBase.agency.name}, без упоминания других компаний
`;
}

// Fallback-режим без API (умные правилопостроенные ответы)
function fallbackResponse(userMessage: string, lead: LeadContext, messageCount: number, declineCount: number): string {
    const knowledgeBase = getKnowledgeBase(lead.projectId, lead.clientCompanyName);
    const msg = userMessage.toLowerCase();
    const brandName = lead.brandName || lead.name;
    const painSummary = formatPainPoints(lead.painPoints);

    if (declineCount >= 2) {
        return `Понял вас, ${brandName}. Спасибо за честный ответ. Если захотите вернуться к вопросу роста на WB, команда ${knowledgeBase.agency.name} на связи.`;
    }

    // Zoom closing
    if (msg.includes('зум') || msg.includes('созвон') || msg.includes('да') || msg.includes('хочу') || msg.includes('интересно')) {
        return `Отлично! 🎯 Давайте запишем вас на короткий созвон (30 мин, бесплатно). Что удобнее — утро или вечер?`;
    }

    // Price objection
    if (msg.includes('дорого') || msg.includes('цена') || msg.includes('сколько стоит') || msg.includes('бюджет')) {
        return `Понимаю. ${knowledgeBase.objectionHandlers['дорого']}`;
    }

    // No time
    if (msg.includes('некогда') || msg.includes('нет времени') || msg.includes('занят')) {
        return knowledgeBase.objectionHandlers['нет времени'];
    }

    // Already working with someone
    if (msg.includes('уже работаем') || msg.includes('есть агентство') || msg.includes('другое агентство')) {
        return knowledgeBase.objectionHandlers['уже работаю с другим агентством'];
    }

    // Skeptical / not interested
    if (msg.includes('не интересно') || msg.includes('не надо') || msg.includes('спасибо нет')) {
        return `Понял вас. Давайте сделаем так: можем провести бесплатный аудит магазина и показать 2-3 точки роста без обязательств. Если не зайдет — просто завершим. Удобно завтра или в конце недели?`;
    }

    // Not sure
    if (msg.includes('не уверен') || msg.includes('подумаю') || msg.includes('посмотрим')) {
        return `${knowledgeBase.objectionHandlers['не уверен']}`;
    }

    // After 2-3 messages, push to zoom
    if (messageCount >= 2) {
        return `${brandName}, хочу предложить быстрый 30-минутный разбор вашего магазина — бесплатно, без обязательств. Найдём конкретные точки роста. Когда удобно — завтра или в конце недели?`;
    }

    // Pain-based response
    if (lead.painPoints && lead.painPoints.length > 0) {
        const caseExample = knowledgeBase.cases[0];
        return `Вижу, что у вас есть ${painSummary}. У нас был похожий клиент — ${caseExample.clientName}: ${caseExample.before} → ${caseExample.after}. ${caseExample.result} Хотите разобраться, как это применить к вашей ситуации?`;
    }

    // Default opener
    return `${brandName}, команда ${knowledgeBase.agency.name} работает с селлерами WB уже несколько лет. Помогаем масштабировать оборот через аналитику и автоматизацию. Какая сейчас самая острая проблема в вашем магазине?`;
}

export async function generateAgentResponse(
    userMessage: string,
    conversationHistory: Message[],
    lead?: LeadContext
): Promise<string> {
    const leadContext: LeadContext = lead || { name: 'Клиент' };
    const messageCount = conversationHistory.filter((m) => m.role === 'user').length;
    const declineCount = conversationHistory.filter((m) => m.role === 'user' && /(не интересно|не надо|спасибо нет|не актуально|не хочу)/i.test(m.content)).length;

    // If no API key — use smart fallback
    if (!GEMINI_API_KEY) {
        console.warn('[ChatAgent] No GEMINI_API_KEY — using fallback mode');
        return fallbackResponse(userMessage, leadContext, messageCount, declineCount);
    }

    const systemPrompt = buildSystemPrompt(leadContext);

    // Build conversation context (last 6 messages)
    const conversationContext = conversationHistory
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'Клиент' : 'Ты'}: ${m.content}`)
        .join('\n');

    const fullPrompt = `${systemPrompt}

=== ИСТОРИЯ ДИАЛОГА ===
${conversationContext}

Клиент: ${userMessage}
Ты:`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    temperature: 0.75,
                    maxOutputTokens: 250,
                },
            }),
        });

        if (!response.ok) {
            console.error('[ChatAgent] API error:', response.status, response.statusText);
            return fallbackResponse(userMessage, leadContext, messageCount, declineCount);
        }

        const data = await response.json();
        const agentMessage =
            data.candidates?.[0]?.content?.parts?.[0]?.text || fallbackResponse(userMessage, leadContext, messageCount, declineCount);

        return agentMessage.trim();
    } catch (error) {
        console.error('[ChatAgent] Network error:', error);
        return fallbackResponse(userMessage, leadContext, messageCount, declineCount);
    }
}
