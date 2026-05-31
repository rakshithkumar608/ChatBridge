// content-scripts/scraper-claude.js
// Strategy order:
//   1. Background API fetch (most accurate — bypasses DOM fragility)
//   2. DOM: data-testid="conversation-turn" (primary stable selector)
//   3. DOM: data-testid="human-turn-input" + adjacent assistant blocks
//   4. DOM: font-user-message / font-claude-message class names
//   5. DOM: broad [class*="message"] sweep with heuristic role detection
//   6. DOM: full innerText of main/article as last resort with role splitting

(function () {
    window.__chatbridge = window.__chatbridge || {};

    window.__chatbridge.scrapeChat = async function () {

        // ── Helper: build the session object ──────────────────────────────────
        function buildSession(msgs, errorNote) {
            // Deduplicate consecutive same-role messages
            const clean = [];
            let lastRole = null;
            for (const m of msgs) {
                if (!m.content || !m.content.trim()) continue;
                const content = m.content.trim();
                if (m.role === lastRole && clean.length > 0) {
                    clean[clean.length - 1].content += '\n\n' + content;
                } else {
                    clean.push({ role: m.role, content, timestamp: Date.now() });
                    lastRole = m.role;
                }
            }
            return {
                provider:   'claude',
                url:        window.location.href,
                title:      document.title,
                messages:   clean,
                capturedAt: new Date().toISOString(),
                errorNote:  errorNote || null
            };
        }

        // ── Extract conversation ID from URL ──────────────────────────────────
        const urlParts = window.location.pathname.split('/').filter(Boolean);
        const conversationId = urlParts[urlParts.length - 1];

        const isValidId = conversationId &&
                          conversationId !== 'new' &&
                          /^[0-9a-f-]{36}$/i.test(conversationId);

        // ── Strategy 1: Background API fetch ─────────────────────────────────
        if (isValidId) {
            try {
                const apiResult = await chrome.runtime.sendMessage({
                    action: 'FETCH_CLAUDE_API',
                    conversationId
                });
                if (apiResult?.success && apiResult.messages?.length > 0) {
                    console.log(`ChatBridge Claude: API strategy got ${apiResult.messages.length} messages.`);
                    return buildSession(apiResult.messages);
                }
                console.warn('ChatBridge Claude: API strategy failed —', apiResult?.error);
            } catch (e) {
                console.warn('ChatBridge Claude: API strategy threw —', e.message);
            }
        }

        // ── DOM strategies ────────────────────────────────────────────────────
        const messages = [];

        // Strategy 2: data-testid="conversation-turn" (most reliable DOM selector)
        const turns = document.querySelectorAll('[data-testid="conversation-turn"]');
        if (turns.length > 0) {
            console.log(`ChatBridge Claude: DOM strategy 2 found ${turns.length} turns.`);
            turns.forEach(turn => {
                const isHuman = !!turn.querySelector('[data-testid="human-turn-input"]') ||
                                !!turn.querySelector('[data-testid="human-turn"]');
                // Get the innermost text content, skipping button/label noise
                const textEls = turn.querySelectorAll('p, li, pre, h1, h2, h3, h4, h5, h6, .whitespace-pre-wrap');
                let text = '';
                if (textEls.length > 0) {
                    text = Array.from(textEls).map(el => el.innerText).join('\n').trim();
                }
                if (!text) text = turn.innerText.trim();
                if (text) messages.push({ role: isHuman ? 'user' : 'assistant', content: text });
            });
            if (messages.length > 0) return buildSession(messages);
        }

        // Strategy 3: data-testid="human-turn-input" individual blocks
        const humanBlocks  = document.querySelectorAll('[data-testid="human-turn-input"]');
        const assistBlocks = document.querySelectorAll('[data-testid="assistant-message-content"], .font-claude-message');
        if (humanBlocks.length > 0 || assistBlocks.length > 0) {
            console.log(`ChatBridge Claude: DOM strategy 3 — ${humanBlocks.length} human, ${assistBlocks.length} assistant.`);
            const allBlocks = [
                ...Array.from(humanBlocks).map(el => ({ el, role: 'user' })),
                ...Array.from(assistBlocks).map(el => ({ el, role: 'assistant' }))
            ];
            // Sort by DOM position
            allBlocks.sort((a, b) => a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
            allBlocks.forEach(({ el, role }) => {
                const text = el.innerText.trim();
                if (text) messages.push({ role, content: text });
            });
            if (messages.length > 0) return buildSession(messages);
        }

        // Strategy 4: .font-user-message / .font-claude-message
        const userMsgs  = document.querySelectorAll('.font-user-message');
        const claudeMsgs = document.querySelectorAll('.font-claude-message');
        if (userMsgs.length > 0 || claudeMsgs.length > 0) {
            console.log(`ChatBridge Claude: DOM strategy 4 — ${userMsgs.length} user, ${claudeMsgs.length} claude.`);
            const allMsgs = [
                ...Array.from(userMsgs).map(el => ({ el, role: 'user' })),
                ...Array.from(claudeMsgs).map(el => ({ el, role: 'assistant' }))
            ];
            allMsgs.sort((a, b) => a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
            allMsgs.forEach(({ el, role }) => {
                const text = el.innerText.trim();
                if (text) messages.push({ role, content: text });
            });
            if (messages.length > 0) return buildSession(messages);
        }

        // Strategy 5: Broad [class*="message"] sweep
        const broadMsgs = document.querySelectorAll('[class*="message"], [class*="Message"]');
        if (broadMsgs.length > 0) {
            console.log(`ChatBridge Claude: DOM strategy 5 — ${broadMsgs.length} broad elements.`);
            broadMsgs.forEach(el => {
                const cls = (el.className || '').toLowerCase();
                const role = (cls.includes('human') || cls.includes('user')) ? 'user' : 'assistant';
                const text = el.innerText.trim();
                if (text && text.length > 5) messages.push({ role, content: text });
            });
            if (messages.length > 0) return buildSession(messages);
        }

        // Strategy 6: prose blocks (AI responses) + whitespace-pre-wrap (user inputs)
        const allProse = document.querySelectorAll('.prose, .whitespace-pre-wrap');
        if (allProse.length > 0) {
            console.log(`ChatBridge Claude: DOM strategy 6 — ${allProse.length} prose/pre elements.`);
            allProse.forEach(node => {
                const isHuman = !node.classList.contains('prose') && !node.closest('.prose');
                const text = node.innerText.trim();
                if (text) messages.push({ role: isHuman ? 'user' : 'assistant', content: text });
            });
            if (messages.length > 0) return buildSession(messages);
        }

        console.error('ChatBridge Claude: all strategies exhausted — 0 messages found.');
        return buildSession([], 'No messages found. Make sure you are inside an active chat, then refresh and try again.');
    };

    // ── Listen for SCRAPE_CHAT messages ──────────────────────────────────────
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'SCRAPE_CHAT') {
            window.__chatbridge.scrapeChat()
                .then(session => sendResponse({ success: true, session }))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }
    });
})();