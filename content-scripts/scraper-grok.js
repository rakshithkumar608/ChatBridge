(function() {
    window.__chatbridge = window.__chatbridge || {};

    window.__chatbridge.scrapeChat = function() {
        const messages = [];
        const turns = document.querySelectorAll('[data-testid="userMessage"], [data-testid="botMessage"]');
        
        turns.forEach((turn) => {
            const role = turn.getAttribute('data-testid') === 'userMessage' ? 'user' : 'assistant';
            const text = turn.innerText.trim();

            if (text) {
                messages.push({
                    role, 
                    content: text,
                    timestamp: Date.now()
                });
            }
        });

        return {
            provider: 'grok',
            url: window.location.href,
            title: document.title,
            messages,
            capturedAt: new Date().toISOString()
        };
    };

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'SCRAPE_CHAT') {
            sendResponse({ success: true, session: window.__chatbridge.scrapeChat() });
        }
        return true;
    });
})();
