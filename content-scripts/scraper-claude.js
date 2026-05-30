(function() {
    window.__chatbridge = window.__chatbridge || {};

    window.__chatbridge.scrapeChat = function() {
        const messages = [];

        //  claude uses specific DOM strucuture - adjust selectors if claude updates their UI
        const turns = document.querySelectorAll('[data-itestid="conversation-turn"]');

        if (turns.length === 0) {
            const humanMsgs = document.querySelectorAll('.font-user-message, [data-is-streaming]');
        }

        turns.forEach((turn) => {
            const isHuman = turn.querySelector('[data-testid="human-turn"]') !== null;
            const isAssistant = turn.querySelector('[data-testid="ai-turn"]') !== null;

            const textEl = turn.querySelector('.whitespace-pre-wrap, p, .prose');
            const text = textEl ? textEl.innerText.trim() : '';

            if (text) {
                messages.push({
                    role: isHuman ? 'user' : 'assistant',
                    content: text,
                    timestamp: Date.now()
                });
            }
        });

        return {
            provider: 'claude',
            url: window.location.href,
            title: document.title,
            messages,
            capturedAt: new Date().toISOString()
        };
    };

    // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'SCRAPE_CHAT') {
      const session = window.__chatbridge.scrapeChat();
      sendResponse({ success: true, session });
    }
    return true; // Keep channel open for async
  });
})();