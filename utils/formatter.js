export function formateForProvider(session, targetProvider) {
    const formatters = {
        claude: formatForClaude,
        chatgpt: formatForChatGPT,
        gemini: formatForGemini
    };

    const fn = formatters[targetProvider] || formatForChatGPT;
    return fn(session);
}

function formatForClaude(session) {
    return session.messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
    }));
}

function formatForChatGPT(session) {
    return session.messages.map(m => ({
        role: m.role,
        content: m.content
    }));
}

function formatForGemini(session) {
    return session.messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));
}