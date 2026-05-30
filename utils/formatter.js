export function formatForProvider(session, targetProvider) {
  const formatters = {
    claude:     formatUserAssistant,
    chatgpt:    formatUserAssistant,
    gemini:     formatForGemini,      // uses 'model' instead of 'assistant'
    groq:       formatUserAssistant,
    deepseek:   formatUserAssistant,
    perplexity: formatUserAssistant,
    mistral:    formatUserAssistant,
    grok:       formatUserAssistant,
    cohere:     formatUserAssistant,
    meta:       formatUserAssistant,
    copilot:    formatUserAssistant,
    poe:        formatUserAssistant
  };

  return (formatters[targetProvider] || formatUserAssistant)(session);
}

function formatUserAssistant(session) {
  return session.messages.map(m => ({ role: m.role, content: m.content }));
}

function formatForGemini(session) {
  return session.messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
}