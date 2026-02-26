import { getKnowledgeBase } from './knowledgeBase';

export interface Message {
    role: 'user' | 'agent';
    content: string;
}

export interface LeadContext {
    id?: string;
    name: string;
    brandName?: string;
    revenue?: number;
    topProduct?: string;
    source?: string;
    painPoints?: string[];
    projectId?: string;
    clientCompanyName?: string;
}

const PAIN_POINT_KEYWORDS: Record<string, string[]> = {
    low_rating: ['рейтинг', 'оценка', 'звёзд', 'звезд', 'rating'],
    stock_issues: ['остаток', 'сток', 'склад', 'stock', 'out of stock', 'fbs'],
    low_trust: ['отзыв', 'доверие', 'review', 'feedback', 'мало отзывов'],
    high_returns: ['возврат', 'return', 'брак', 'обмен'],
    poor_seo: ['seo', 'поиск', 'ключевые', 'выдача', 'карточка', 'описание'],
};

export function inferPainPointsFromText(text: string): string[] {
    if (!text) return [];
    const lower = text.toLowerCase();
    const found: string[] = [];
    for (const [pain, keywords] of Object.entries(PAIN_POINT_KEYWORDS)) {
        if (keywords.some(kw => lower.includes(kw))) {
            found.push(pain);
        }
    }
    return found;
}

function formatRevenue(revenue?: number): string {
    if (!revenue) return 'не указан';
    if (revenue >= 1_000_000) return `${(revenue / 1_000_000).toFixed(1)}M RUB/мес`;
    return `${revenue.toLocaleString()} RUB/мес`;
}

function buildSystemPrompt(lead?: LeadContext): string {
    const kb = getKnowledgeBase(lead?.projectId, lead?.clientCompanyName);
    const companyName = lead?.clientCompanyName || kb.agency.name;

    let prompt = `Ты — опытный sales-менеджер агентства "${companyName}".
Твоя цель — довести лида до назначения Zoom-звонка.
Используй технику SPIN-selling. Задавай вопросы про боли.
Будь кратким (до 3 предложений), дружелюбным и профессиональным.

Информация об агентстве:
- Название: ${kb.agency.name}
- Год основания: ${kb.agency.foundedYear}
- Опыт: ${kb.agency.experience}

УТП:
${kb.utp.map((u, i) => `${i + 1}. ${u}`).join('\n')}

Кейсы:
${kb.cases.map(c => `- ${c.clientName}: ${c.before} → ${c.after}. ${c.result}`).join('\n')}
`;

    if (lead) {
        prompt += `\nИнформация о лиде:\n`;
        prompt += `- Имя: ${lead.brandName || lead.name}\n`;
        prompt += `- Оборот: ${formatRevenue(lead.revenue)}\n`;
        if (lead.topProduct) prompt += `- Топ-товар: ${lead.topProduct}\n`;
        if (lead.source) prompt += `- Источник: ${lead.source}\n`;
        if (lead.painPoints && lead.painPoints.length > 0) {
            prompt += `- Боли: ${lead.painPoints.join(', ')}\n`;
        }
    }

    prompt += `\nОбработка возражений:\n`;
    for (const [objection, response] of Object.entries(kb.objectionHandlers)) {
        prompt += `Если клиент говорит "${objection}": ${response}\n`;
    }

    prompt += `\nПравила:\n`;
    prompt += `1. Не начинай сразу продавать — задавай вопросы\n`;
    prompt += `2. Используй кейсы как социальные доказательства\n`;
    prompt += `3. Предлагай Zoom-звонок когда клиент проявит интерес\n`;
    prompt += `4. Отвечай на русском языке\n`;

    return prompt;
}

function buildFallbackResponse(userMessage: string, lead?: LeadContext): string {
    const lower = userMessage.toLowerCase();
    const name = lead?.brandName || lead?.name || 'друг';

    if (lower.includes('дорого') || lower.includes('цена') || lower.includes('стоимость')) {
        const kb = getKnowledgeBase(lead?.projectId, lead?.clientCompanyName);
        const handler = kb.objectionHandlers['дорого'];
        if (handler) return handler;
        return `${name}, давайте посчитаем ROI — обычно клиенты возвращают вложения за 2-3 месяца. Предлагаю обсудить на Zoom с конкретными цифрами для вашей ниши. Когда удобно?`;
    }

    if (lower.includes('думаю') || lower.includes('подумаю') || lower.includes('позже')) {
        return `Конечно, ${name}. Давайте я пришлю вам короткий кейс похожего селлера, чтобы было что оценить пока думаете? 📊`;
    }

    if (lower.includes('zoom') || lower.includes('звонок') || lower.includes('встреч')) {
        return `Отлично! 🎯 Давайте назначим Zoom на 15-20 минут — покажу конкретные цифры и план действий для вашего магазина. Какое время удобно?`;
    }

    if (lower.includes('проблем') || lower.includes('боли') || lower.includes('слож')) {
        return `Спасибо за откровенность, ${name}. Это распространённая проблема — у нас есть проверенные решения. Расскажите подробнее, и я предложу конкретный план. 💡`;
    }

    if (lower.includes('да') || lower.includes('интересно') || lower.includes('расскажите')) {
        return `Отлично, ${name}! 🚀 Самый быстрый способ — созвониться на 15 минут в Zoom. Я покажу, как мы увеличили Х3 оборот похожему селлеру. Когда вам удобно?`;
    }

    return `Понял вас, ${name}. У нас есть опыт работы с селлерами в похожей ситуации. Хотите, расскажу подробнее, как мы решаем такие задачи? 😊`;
}

export async function generateAgentResponse(
    userMessage: string,
    conversationHistory: Message[],
    lead?: LeadContext
): Promise<string> {
    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (globalThis as any).process?.env?.GEMINI_API_KEY;

    if (!apiKey) {
        console.warn('[ChatAgent] No Gemini API key found, using fallback responses');
        return buildFallbackResponse(userMessage, lead);
    }

    try {
        const systemPrompt = buildSystemPrompt(lead);

        const contents = [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: 'Понял. Я готов вести диалог как sales-менеджер.' }] }
        ];

        for (const msg of conversationHistory) {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        }

        contents.push({ role: 'user', parts: [{ text: userMessage }] });

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 300,
                        topP: 0.9,
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('Empty response from Gemini');
        }

        return text.trim();
    } catch (error) {
        console.error('[ChatAgent] Gemini API failed, using fallback:', error);
        return buildFallbackResponse(userMessage, lead);
    }
}
