// content-scripts/scraper-claude.js — v3
// Handles both regular chats AND agentic/tool-use sessions.
//
// Strategy order:
//   1. Background API fetch  (most accurate — walks the message tree)
//   2. data-testid="conversation-turn"  (primary stable Claude selector)
//   3. data-testid="human-turn-input" + data-testid="claude-message"
//   4. .font-user-message / .font-claude-message
//   5. Broad [class*="message"] heuristic sweep
//   6. .prose / .whitespace-pre-wrap blocks
//   7. NUCLEAR: every visible text block in main container

(function () {
    window.__chatbridge = window.__chatbridge || {};

    // ── Build + clean the session object ─────────────────────────────────────
    function buildSession(msgs, errorNote) {
        const clean = [];
        let lastRole = null;
        for (const m of msgs) {
            if (!m || !m.content) continue;
            const content = (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).trim();
            if (!content) continue;
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

    window.__chatbridge.scrapeChat = async function () {
        const messages = [];
        const log = (...a) => console.log('%c[ChatBridge Claude]', 'color:#c96; font-weight:bold', ...a);
        const warn = (...a) => console.warn('%c[ChatBridge Claude]', 'color:#c96; font-weight:bold', ...a);

        // ── Extract conversation ID from URL ──────────────────────────────────
        // Handles: /chat/UUID, /chat/UUID/branch/..., etc.
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const UUID_RE   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const conversationId = pathParts.find(p => UUID_RE.test(p));

        log('URL path parts:', pathParts, '→ conversationId:', conversationId);

        if (!conversationId) {
            log('No valid UUID in URL — skipping API strategy.');
        }

        // ── STRATEGY 1: Background API fetch ─────────────────────────────────
        if (conversationId) {
            try {
                log('Trying Strategy 1: background API fetch...');
                const apiResult = await chrome.runtime.sendMessage({
                    action: 'FETCH_CLAUDE_API',
                    conversationId
                });
                log('API result:', apiResult?.success, '| messages:', apiResult?.messages?.length ?? 0, '| error:', apiResult?.error);
                if (apiResult?.success && apiResult.messages?.length > 0) {
                    log(`Strategy 1 SUCCESS — ${apiResult.messages.length} messages.`);
                    return buildSession(apiResult.messages);
                }
                warn('Strategy 1 failed:', apiResult?.error || 'unknown error');
            } catch (e) {
                warn('Strategy 1 threw:', e.message);
            }
        }

        // ── DOM strategies ────────────────────────────────────────────────────
        // Helper: sort elements by DOM order
        const domSort = (arr) => arr.sort((a, b) =>
            a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );

        // Helper: get best text from an element (prefer structured children over raw innerText)
        const getText = (el) => {
            const structured = el.querySelectorAll('p, li, pre, h1, h2, h3, h4, td, th, .whitespace-pre-wrap');
            if (structured.length > 0) {
                return [...structured].map(n => n.innerText).join('\n').trim();
            }
            return el.innerText.trim();
        };

        // ── STRATEGY 2: data-testid="conversation-turn" ───────────────────────
        {
            log('Trying Strategy 2: data-testid="conversation-turn"...');
            const turns = document.querySelectorAll('[data-testid="conversation-turn"]');
            log(`  Found ${turns.length} conversation turns.`);
            if (turns.length > 0) {
                turns.forEach(turn => {
                    // Human turn detection — try multiple testid variants
                    const isHuman =
                        !!turn.querySelector('[data-testid="human-turn-input"]') ||
                        !!turn.querySelector('[data-testid="human-turn"]') ||
                        !!turn.querySelector('[data-is-streaming="false"][data-role="human"]') ||
                        turn.getAttribute('data-role') === 'human' ||
                        turn.getAttribute('data-role') === 'user';

                    const text = getText(turn);
                    if (text) messages.push({ role: isHuman ? 'user' : 'assistant', content: text });
                });

                if (messages.length > 0) {
                    log(`Strategy 2 SUCCESS — ${messages.length} messages extracted.`);
                    return buildSession(messages);
                }
                warn('Strategy 2: turns found but 0 text extracted. Trying next...');
            }
        }

        // ── STRATEGY 3: individual human-turn / assistant-turn testids ────────
        {
            log('Trying Strategy 3: individual human/assistant testid blocks...');
            const selectors = [
                { sel: '[data-testid="human-turn-input"]', role: 'user' },
                { sel: '[data-testid="human-turn"]',       role: 'user' },
                { sel: '[data-testid="claude-message"]',   role: 'assistant' },
                { sel: '[data-testid="assistant-message-content"]', role: 'assistant' }
            ];
            const allBlocks = [];
            selectors.forEach(({ sel, role }) => {
                document.querySelectorAll(sel).forEach(el => allBlocks.push({ el, role }));
            });
            log(`  Found ${allBlocks.length} testid blocks.`);
            if (allBlocks.length > 0) {
                domSort(allBlocks).forEach(({ el, role }) => {
                    const text = getText(el);
                    if (text) messages.push({ role, content: text });
                });
                if (messages.length > 0) {
                    log(`Strategy 3 SUCCESS — ${messages.length} messages.`);
                    return buildSession(messages);
                }
            }
        }

        // ── STRATEGY 4: font-user-message / font-claude-message ───────────────
        {
            log('Trying Strategy 4: font-user-message / font-claude-message...');
            const userMsgs   = document.querySelectorAll('.font-user-message');
            const claudeMsgs = document.querySelectorAll('.font-claude-message');
            log(`  Found ${userMsgs.length} user, ${claudeMsgs.length} claude.`);
            if (userMsgs.length + claudeMsgs.length > 0) {
                const allBlocks = [
                    ...[...userMsgs].map(el => ({ el, role: 'user' })),
                    ...[...claudeMsgs].map(el => ({ el, role: 'assistant' }))
                ];
                domSort(allBlocks).forEach(({ el, role }) => {
                    const text = getText(el);
                    if (text) messages.push({ role, content: text });
                });
                if (messages.length > 0) {
                    log(`Strategy 4 SUCCESS — ${messages.length} messages.`);
                    return buildSession(messages);
                }
            }
        }

        // ── STRATEGY 5: broad [class*="message"] heuristic ────────────────────
        {
            log('Trying Strategy 5: broad [class*=message] heuristic...');
            const broadSel = [
                '[class*="humanMessage"]', '[class*="assistantMessage"]',
                '[class*="human-message"]', '[class*="assistant-message"]',
                '[class*="UserMessage"]', '[class*="AssistantMessage"]',
                '[class*="user-message"]', '[class*="bot-message"]',
                '[data-role="user"]', '[data-role="assistant"]',
                '[data-role="human"]'
            ].join(', ');
            const broadEls = document.querySelectorAll(broadSel);
            log(`  Found ${broadEls.length} broad elements.`);
            if (broadEls.length > 0) {
                broadEls.forEach(el => {
                    const cls  = (el.className || '').toLowerCase();
                    const role_ = el.getAttribute('data-role');
                    const role = role_ === 'user' || role_ === 'human' ||
                                 cls.includes('human') || cls.includes('user')
                        ? 'user' : 'assistant';
                    const text = getText(el);
                    if (text && text.length > 3) messages.push({ role, content: text });
                });
                if (messages.length > 0) {
                    log(`Strategy 5 SUCCESS — ${messages.length} messages.`);
                    return buildSession(messages);
                }
            }
        }

        // ── STRATEGY 6: .prose / .whitespace-pre-wrap alternation ─────────────
        {
            log('Trying Strategy 6: prose + whitespace-pre-wrap...');
            const proseEls = document.querySelectorAll('.prose, .whitespace-pre-wrap');
            log(`  Found ${proseEls.length} prose/pre elements.`);
            if (proseEls.length > 0) {
                proseEls.forEach(node => {
                    const isUser = !node.classList.contains('prose') && !node.closest('.prose');
                    const text   = node.innerText.trim();
                    if (text) messages.push({ role: isUser ? 'user' : 'assistant', content: text });
                });
                if (messages.length > 0) {
                    log(`Strategy 6 SUCCESS — ${messages.length} messages.`);
                    return buildSession(messages);
                }
            }
        }

        // ── STRATEGY 7: NUCLEAR — walk every text block in the main container ─
        {
            warn('All targeted strategies failed. Trying nuclear DOM sweep...');
            const chatRoot = document.querySelector('main') ||
                             document.querySelector('[class*="chat"]') ||
                             document.body;

            // Get all leaf-ish text nodes with meaningful content
            const textEls = chatRoot.querySelectorAll('p, pre, li, blockquote, h1, h2, h3, h4');
            const allTexts = [...textEls]
                .map(el => el.innerText.trim())
                .filter(t => t.length > 10);

            log(`Nuclear sweep found ${allTexts.length} text blocks.`);

            if (allTexts.length > 0) {
                // We can't determine roles, so dump everything as one assistant message with a note
                messages.push({
                    role:    'user',
                    content: '[NOTE: ChatBridge nuclear fallback — could not separate user/assistant turns. ' +
                             'Please open DevTools (F12 → Console) and look for [ChatBridge Claude] logs ' +
                             'to help debug.]\n\nFull chat text:\n\n' + allTexts.join('\n\n')
                });
                return buildSession(messages);
            }
        }

        warn('ALL 7 strategies returned 0 messages. Is the page fully loaded?');
        return buildSession([], '0 messages found — open DevTools console and look for [ChatBridge Claude] logs.');
    };

    // ── Message listener ──────────────────────────────────────────────────────
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'SCRAPE_CHAT') {
            window.__chatbridge.scrapeChat()
                .then(session => sendResponse({ success: true, session }))
                .catch(err   => sendResponse({ success: false, error: err.message }));
            return true;
        }
    });
})();