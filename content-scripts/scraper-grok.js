(function() {
    window.__chatbridge = window.__chatbridge || {};

    window.__chatbridge.scrapeChat = function() {
        const messages = [];

        // Strategy 1: data-testid attributes (Grok's known structure)
        const testIdNodes = document.querySelectorAll(
            '[data-testid="userMessage"], [data-testid="botMessage"], ' +
            '[data-testid="user-message"], [data-testid="bot-message"]'
        );
        if (testIdNodes.length > 0) {
            testIdNodes.forEach(el => {
                const tid = el.getAttribute('data-testid') || '';
                const isUser = tid.toLowerCase().includes('user');
                const text = el.innerText.trim();
                if (text) messages.push({ role: isUser ? 'user' : 'assistant', content: text, timestamp: Date.now() });
            });
            if (messages.length > 0) return buildSession();
        }

        // Strategy 2: message-bubble class patterns (Grok uses Tailwind with hashed names sometimes)
        const bubbleNodes = document.querySelectorAll(
            '[class*="message-bubble"], [class*="MessageBubble"], ' +
            '[class*="userMessage"], [class*="botMessage"], ' +
            '[class*="humanMessage"], [class*="assistantMessage"]'
        );
        if (bubbleNodes.length > 0) {
            bubbleNodes.forEach(el => {
                const cls = el.className.toLowerCase();
                const isUser = cls.includes('user') || cls.includes('human');
                const text = el.innerText.trim();
                if (text) messages.push({ role: isUser ? 'user' : 'assistant', content: text, timestamp: Date.now() });
            });
            if (messages.length > 0) return buildSession();
        }

        // Strategy 3: role or aria attributes
        const ariaNodes = document.querySelectorAll('[role="article"], [aria-label*="message"], [aria-label*="Message"]');
        if (ariaNodes.length > 0) {
            ariaNodes.forEach((el, i) => {
                const label = (el.getAttribute('aria-label') || '').toLowerCase();
                const isUser = label.includes('you') || label.includes('user') || label.includes('human') || i % 2 === 0;
                const text = el.innerText.trim();
                if (text) messages.push({ role: isUser ? 'user' : 'assistant', content: text, timestamp: Date.now() });
            });
            if (messages.length > 0) return buildSession();
        }

        // Strategy 4: prose / whitespace-pre-wrap heuristic (universal Tailwind fallback)
        const processedNodes = new Set();
        document.querySelectorAll('.prose, .whitespace-pre-wrap').forEach(node => {
            if (processedNodes.has(node)) return;
            if (node.classList.contains('whitespace-pre-wrap') && node.closest('.prose')) return;
            node.querySelectorAll('*').forEach(child => processedNodes.add(child));
            processedNodes.add(node);
            const isHuman = !node.classList.contains('prose') && !node.closest('.prose');
            const text = node.innerText.trim();
            if (text) {
                const lastMsg = messages[messages.length - 1];
                if (lastMsg && lastMsg.role === (isHuman ? 'user' : 'assistant') && lastMsg.content === text) return;
                messages.push({ role: isHuman ? 'user' : 'assistant', content: text, timestamp: Date.now() });
            }
        });

        return buildSession();

        function buildSession() {
            // Merge consecutive same-role messages
            const clean = [];
            let lastRole = null;
            for (const m of messages) {
                if (m.role === lastRole) clean[clean.length - 1].content += '\n\n' + m.content;
                else { clean.push({ ...m }); lastRole = m.role; }
            }
            return { provider: 'grok', url: location.href, title: document.title, messages: clean, capturedAt: new Date().toISOString() };
        }
    };

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'SCRAPE_CHAT') {
            sendResponse({ success: true, session: window.__chatbridge.scrapeChat() });
        }
        return true;
    });
})();
