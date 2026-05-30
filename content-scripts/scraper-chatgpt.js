(function() {
    window.__chatbridge = window.__chatbridge || {};

    window.__chatbridge.scrapeChat = function() {
        const messages = [];

        // ChatGPT DOM selectors (as of 2024-2025)
        const turns = document.querySelectorAll('[data-message-author-role]');
        
        turns.forEach((turn) => {
            const role = turn.getAttribute('data-message-author-role'); // 'user' or 'assistant'
            const contentEl = turn.querySelector('.markdown, .whitespace-pre-wrap, p');
            const text = contentEl ? contentEl.innerText.trim() : turn.innerText.trim();


            if (text) {
                messages.push({
                    role, 
                    content: text,
                    timestamp: Date.now()
                });
            }
        });

        return {
            provider: 'chatgpt',
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
    })
})();