(function() {
    window.__chatbridge = window.__chatbridge || {};

    window.__chatbridge.scrapeChat = function() {
        const messages = [];


        // Gemini DOM
        const userTurns = document.querySelectorAll('user-query .query-text, .user-query-text');
        const modelTurns = document.querySelectorAll('model-response .response-content, .model-response-text');

        const maxLen = Math.max(userTurns.length, modelTurns.length);

        for (let i = 0; i < maxLen; i++) {
            if (userTurns[i]) {
                messages.push({ role: 'user', content: userTurns[i].innerText.trim() });
            }
            
            if (modelTurns[i]) {
                messages.push({ role: 'assistant', content: modelTurns[i].innerText.trim() });
            }
        }

        return {
            provider: 'gemini',
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