(function() {
    window.__chatbridge = window.__chatbridge || {};

    window.__chatbridge.scrapeChat = async function() {
        // Extract conversation ID from URL
        // e.g. https://claude.ai/chat/df80a62a-84f1-483c-970e-9e861347bdc9
        const urlParts = window.location.pathname.split('/').filter(Boolean);
        const conversationId = urlParts[urlParts.length - 1];

        if (!conversationId || conversationId === 'new' || !conversationId.includes('-')) {
            return buildSession([], 'No active conversation. Please open an existing chat first.');
        }

        // Delegate the API call to the background service worker
        // (background scripts bypass page CSP restrictions)
        const apiResult = await chrome.runtime.sendMessage({
            action: 'FETCH_CLAUDE_API',
            conversationId
        });

        if (apiResult?.success && apiResult.messages?.length > 0) {
            return buildSession(apiResult.messages);
        }

        console.warn('ChatBridge Claude API failed:', apiResult?.error, '— falling back to DOM');

        // --- DOM Fallback ---
        const messages = [];

        // Try old UI selectors
        const turns = document.querySelectorAll('[data-testid="conversation-turn"]');
        if (turns.length > 0) {
            turns.forEach(turn => {
                const isHuman = turn.querySelector('[data-testid="human-turn"]') !== null;
                const textEl = turn.querySelector('.whitespace-pre-wrap, p, .prose');
                const text = (textEl ? textEl.innerText : turn.innerText).trim();
                if (text) messages.push({ role: isHuman ? 'user' : 'assistant', content: text, timestamp: Date.now() });
            });
            if (messages.length > 0) return buildSession(messages);
        }

        // Try newer UI selectors
        const newNodes = document.querySelectorAll('.font-user-message, .font-claude-message');
        if (newNodes.length > 0) {
            newNodes.forEach(node => {
                const isHuman = node.classList.contains('font-user-message');
                const text = node.innerText.trim();
                if (text) messages.push({ role: isHuman ? 'user' : 'assistant', content: text, timestamp: Date.now() });
            });
            if (messages.length > 0) return buildSession(messages);
        }

        return buildSession(messages);

        function buildSession(msgs, errorNote) {
            return {
                provider: 'claude',
                url: window.location.href,
                title: document.title,
                messages: msgs,
                capturedAt: new Date().toISOString(),
                errorNote: errorNote || null
            };
        }
    };

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'SCRAPE_CHAT') {
            window.__chatbridge.scrapeChat()
                .then(session => sendResponse({ success: true, session }))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }
    });
})();