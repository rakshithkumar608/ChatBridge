(function() {
    window.__chatbridge = window.__chatbridge || {};

    window.__chatbridge.scrapeChat = function() {
        const messages = [];

        // claude uses specific DOM strucuture - adjust selectors if claude updates their UI
        const turns = document.querySelectorAll('[data-testid="conversation-turn"]');

        if (turns.length > 0) {
            turns.forEach((turn) => {
                const isHuman = turn.querySelector('[data-testid="human-turn"]') !== null;
                const textEl = turn.querySelector('.whitespace-pre-wrap, p, .prose');
                const text = textEl ? textEl.innerText.trim() : turn.innerText.trim();

                if (text) {
                    messages.push({
                        role: isHuman ? 'user' : 'assistant',
                        content: text,
                        timestamp: Date.now()
                    });
                }
            });
        } else {
            // Fallback for newer Claude UI
            const allNodes = document.querySelectorAll('.font-user-message, .font-claude-message');
            allNodes.forEach((node) => {
                const isHuman = node.classList.contains('font-user-message');
                const text = node.innerText.trim();
                if (text) {
                    messages.push({
                        role: isHuman ? 'user' : 'assistant',
                        content: text,
                        timestamp: Date.now()
                    });
                }
            });
        }

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