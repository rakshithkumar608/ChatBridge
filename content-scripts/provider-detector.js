(function() {
    const PROVIDERS = {
    'claude.ai':                'claude',
  'chat.openai.com':          'chatgpt',
  'chatgpt.com':              'chatgpt',
  'gemini.google.com':        'gemini',
  'groq.com':                 'groq',
  'chat.deepseek.com':        'deepseek',
  'www.perplexity.ai':        'perplexity',
  'chat.mistral.ai':          'mistral',
  'grok.com':                 'grok',
  'x.com':                    'grok',       // x.com/i/grok
  'coral.cohere.com':         'cohere',
  'meta.ai':                  'meta',
  'copilot.microsoft.com':    'copilot',
  'poe.com':                  'poe'
    };

    const host = window.location.hostname;
    const provider = PROVIDERS[host] || 'unknown';

    window.__chatbridge = window.__chatbridge || {};
    window.__chatbridge.provider = provider;

    // Tell background which provider this tab is
    chrome.runtime.sendMessage({ action: 'PROVIDER_DETECTED', provider, url: window.location.href });
})();