import { fetch, Body } from '../../../utils/http';
import { defaultRequestArguments, defaultSystemPrompt, defaultUserPrompt } from './Config';

export async function recognize(base64, language, options = {}) {
    const { config } = options;

    let { requestPath, model, apiKey, systemPrompt, userPrompt, requestArguments } = config;

    if (!requestPath) {
        throw 'Please configure request path';
    }
    if (!/https?:\/\/.+/.test(requestPath)) {
        requestPath = `https://${requestPath}`;
    }
    const apiUrl = new URL(requestPath);
    // in openai like api, /v1 is not required
    if (!apiUrl.pathname.endsWith('/chat/completions')) {
        apiUrl.pathname += apiUrl.pathname.endsWith('/') ? '' : '/';
        apiUrl.pathname += 'v1/chat/completions';
    }

    // 兼容旧版
    systemPrompt = systemPrompt ?? defaultSystemPrompt;
    userPrompt = userPrompt ?? defaultUserPrompt;

    const languageName = language === 'Auto' ? 'the language shown in the image' : language;
    const replacePlaceholder = (content) => content.replaceAll('$language', languageName);

    const messages = [];
    if (systemPrompt.trim() !== '') {
        messages.push({ role: 'system', content: replacePlaceholder(systemPrompt) });
    }
    messages.push({
        role: 'user',
        content: [
            { type: 'text', text: replacePlaceholder(userPrompt) },
            {
                type: 'image_url',
                image_url: {
                    url: `data:image/png;base64,${base64}`,
                },
            },
        ],
    });

    const body = {
        ...JSON.parse(requestArguments ?? defaultRequestArguments),
        model,
        messages,
    };

    const res = await fetch(apiUrl.href, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: Body.json(body),
    });

    if (res.ok) {
        const result = res.data;
        const { choices } = result;
        if (choices) {
            let target = choices[0].message.content;
            if (target) {
                return target.trim();
            } else {
                throw JSON.stringify(choices);
            }
        } else {
            throw JSON.stringify(result);
        }
    } else {
        throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`;
    }
}

export * from './Config';
export * from './info';
