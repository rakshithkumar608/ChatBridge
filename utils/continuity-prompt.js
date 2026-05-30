export function buildContinuityPrompt(session, options = {}) {
    const {
        includeFullHistory = true,
        targetProvider = 'auto'
    } = options;
    const msgs = session.messages;
    const provider = session.provider;

    const providerNames = {
        claude: 'Claude (Anthropic)',
        chatgpt: 'ChatGPT (OpenAI)',
        gemini: 'Gemini (Google)'
    };

    let prompt = `I was having a conversation with ${providerNames[provider] || 'an AI assistant'} and I need to continue it here. Please read the conversation history below and then continue from where we left off, maintaining the same context, tone, and any ongoing tasks.\n\n`;

    prompt += `--- CONVERSATION HISTORY ---\n\n`;

    msgs.forEach((msg) => {
        if (msg.isCompressed) {
            prompt += `${msg.content}\n\n`;
        } else {
            const label = msg.role === 'user' ? 'USER' : 'ASSISTANT';
            prompt += `${label}: ${msg.content}\n\n`;
        }
    });

    prompt += `--- END OF HISTORY ---\n\n`;
    prompt += `Please acknowledge that you've read the above context and are ready to continue the conversation. Then ask me how you can help next.`;

    return prompt;
}

export function buildEnhancedPrompt(originalPrompt, enhancements = {}) {
    const {
        addContext = '',
        tsrgetAudience = '',
        outputFormat = '',
        tone = ''
    } = enhancements;
    let enhanced = originalPrompt;  

    if (addContext) enhanced += `\n\nContext: ${addContext}`;
    if (targetAudience) enhanced += `\n\nTarget audience: ${targetAudience}`;
    if (outputFormat) enhanced += `\n\nOutput format: ${outputFormat}`;
    if (tone) enhanced += `\n\nTone: ${tone}`;

    return enhanced;
    
    }
