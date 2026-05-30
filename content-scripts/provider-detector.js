(function() {
    const PROVIDERS = {
        'claude.ai': 'claude',
        'chat.openai.com': 'chatgpt',
        'chatgpt.com': 'chatgpt',
        'gemini.google.com': 'gemini'
    };

    const host = window.location.hostname;
    const provider = PROVIDERS[host] || 'unknown';

    window.__chatbridge = window.__chatbridge || {};
    window.__chatbridge.provider = provider;

    // Tell background which provider this tab is
    chrome.runtime.sendMessage({ action: 'PROVIDER_DETECTED', provider, url: window.location.href });
})();