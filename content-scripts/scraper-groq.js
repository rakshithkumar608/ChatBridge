// content-scripts/scraper-groq.js
// Strategy order:
//   1. React fiber walk — find props.messages array in component tree
//   2. DOM: [data-message-author-role] (Groq adopted OpenAI-style attributes)
//   3. DOM: article elements (Groq wraps each turn in <article>)
//   4. DOM: [class*="message"] broad sweep with heuristic role detection
//   5. DOM: alternating-block heuristic — odd blocks = user, even = assistant
//   6. Full-text extraction from main container as last resort

(function () {
    window.__chatbridge = window.__chatbridge || {};

    window.__chatbridge.scrapeChat = async function () {
        const messages = [];

        // ── Helper: build the final session ──────────────────────────────────
        function buildSession() {
            const clean = [];
            let lastRole = null;
            for (const m of messages) {
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
                provider:   'groq',
                url:        location.href,
                title:      document.title,
                messages:   clean,
                capturedAt: new Date().toISOString()
            };
        }

        // ── Strategy 1: React fiber walk ──────────────────────────────────────
        // Groq builds on Next.js / React — messages are in component state.
        // We walk the fiber tree looking for a messages array with role+content.
        try {
            const findReactFiber = (el) => {
                const key = Object.keys(el).find(
                    k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
                );
                return key ? el[key] : null;
            };

            const extractFromFiber = (fiber) => {
                const found = [];
                let   node  = fiber;
                let   depth = 0;
                const MAX   = 300; // increased from 200

                while (node && depth < MAX) {
                    depth++;
                    try {
                        const state = node.memoizedState;
                        const props = node.memoizedProps || node.pendingProps;

                        // Check memoizedState linked list for messages
                        let s = state;
                        let sDepth = 0;
                        while (s && sDepth < 30) {
                            sDepth++;
                            const q = s.queue?.lastRenderedState ?? s.memoizedState;
                            if (Array.isArray(q)) {
                                q.forEach(m => {
                                    if (m && typeof m.role === 'string' && m.content) {
                                        found.push({
                                            role:    m.role === 'human' ? 'user' : m.role,
                                            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
                                        });
                                    }
                                });
                                if (found.length > 0) return found;
                            }
                            s = s.next;
                        }

                        // Check props directly
                        if (props) {
                            const candidates = [
                                props.messages,
                                props.chat?.messages,
                                props.conversation?.messages,
                                props.data?.messages,
                                props.history,
                                props.chatHistory
                            ];
                            for (const candidate of candidates) {
                                if (Array.isArray(candidate) && candidate.length > 0) {
                                    candidate.forEach(m => {
                                        if (m && typeof m.role === 'string' && m.content) {
                                            found.push({
                                                role:    m.role === 'human' ? 'user' : m.role,
                                                content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
                                            });
                                        }
                                    });
                                    if (found.length > 0) return found;
                                }
                            }
                        }
                    } catch (_) { /* guard against cross-origin / sealed props */ }

                    // Walk: child first, then sibling, then parent's sibling
                    node = node.child || node.sibling || (node.return ? node.return.sibling : null);
                }
                return found;
            };

            // Try several root containers — Groq changed from #__next to specific data attrs
            const roots = document.querySelectorAll(
                'main, #__next, [data-radix-scroll-area-viewport], ' +
                '[class*="chat"], [class*="Chat"], [class*="conversation"]'
            );

            for (const root of roots) {
                const fiber = findReactFiber(root);
                if (!fiber) continue;
                const fiberMsgs = extractFromFiber(fiber);
                if (fiberMsgs.length > 0) {
                    console.log(`ChatBridge Groq: React fiber strategy found ${fiberMsgs.length} messages.`);
                    fiberMsgs.forEach(m => messages.push({ ...m, timestamp: Date.now() }));
                    return buildSession();
                }
            }
            console.warn('ChatBridge Groq: React fiber strategy found 0 messages.');
        } catch (e) {
            console.warn('ChatBridge Groq: React fiber strategy threw —', e.message);
        }

        // ── Strategy 2: data-message-author-role (OpenAI-compatible attribute) ─
        // Groq's cloud UI adopted this attribute (mirrors ChatGPT's DOM)
        const roleAttrs = document.querySelectorAll('[data-message-author-role]');
        if (roleAttrs.length > 0) {
            console.log(`ChatBridge Groq: DOM strategy 2 found ${roleAttrs.length} role-attributed elements.`);
            roleAttrs.forEach(el => {
                const role = el.getAttribute('data-message-author-role');
                const text = el.innerText.trim();
                if (text && (role === 'user' || role === 'assistant')) {
                    messages.push({ role, content: text });
                }
            });
            if (messages.length > 0) return buildSession();
        }

        // ── Strategy 3: <article> elements (Groq wraps each message in article) ─
        const articles = document.querySelectorAll('article');
        if (articles.length > 0) {
            console.log(`ChatBridge Groq: DOM strategy 3 found ${articles.length} article elements.`);
            articles.forEach((art, i) => {
                // Even index = user, odd = assistant (Groq's typical order)
                // But also check aria labels or inner class hints
                const cls  = (art.className || art.getAttribute('class') || '').toLowerCase();
                const aria = (art.getAttribute('aria-label') || '').toLowerCase();
                let role;
                if (cls.includes('human') || cls.includes('user') ||
                    aria.includes('user') || aria.includes('human')) {
                    role = 'user';
                } else if (cls.includes('assistant') || cls.includes('bot') ||
                           aria.includes('assistant')) {
                    role = 'assistant';
                } else {
                    // Fallback: alternate; first message is usually user
                    role = i % 2 === 0 ? 'user' : 'assistant';
                }
                const text = art.innerText.trim();
                if (text) messages.push({ role, content: text });
            });
            if (messages.length > 0) return buildSession();
        }

        // ── Strategy 4: Broad class-based sweep ───────────────────────────────
        const classSelectors = [
            '.message-row', '.human-turn', '.assistant-turn',
            '[data-role="user"]', '[data-role="assistant"]',
            '[class*="humanMessage"]', '[class*="assistantMessage"]',
            '[class*="human-message"]', '[class*="assistant-message"]',
            '[class*="user-message"]', '[class*="bot-message"]',
            '[class*="UserMessage"]', '[class*="AssistantMessage"]'
        ];
        const broadMsgs = document.querySelectorAll(classSelectors.join(', '));
        if (broadMsgs.length > 0) {
            console.log(`ChatBridge Groq: DOM strategy 4 found ${broadMsgs.length} class-matched elements.`);
            broadMsgs.forEach(el => {
                const cls  = (el.className || '').toLowerCase();
                const role = (cls.includes('human') || cls.includes('user')) ? 'user' : 'assistant';
                const text = el.innerText.trim();
                if (text) messages.push({ role, content: text });
            });
            if (messages.length > 0) return buildSession();
        }

        // ── Strategy 5: Alternating prose/pre-wrap blocks ────────────────────
        // Groq uses Tailwind prose classes for assistant and plain divs for user
        const proseBlocks = document.querySelectorAll(
            '.prose, .markdown, [class*="prose"], .whitespace-pre-wrap'
        );
        if (proseBlocks.length > 0) {
            console.log(`ChatBridge Groq: DOM strategy 5 found ${proseBlocks.length} prose blocks.`);
            proseBlocks.forEach(node => {
                // Prose = assistant, non-prose = user
                const isUser = !node.classList.contains('prose') &&
                               !node.classList.contains('markdown') &&
                               !node.closest('.prose') &&
                               !node.closest('.markdown');
                const text = node.innerText.trim();
                if (text) messages.push({ role: isUser ? 'user' : 'assistant', content: text });
            });
            if (messages.length > 0) return buildSession();
        }

        // ── Strategy 6: Full-page text extraction (last resort) ──────────────
        // Grab all meaningful text blocks from the main chat container
        const mainEl = document.querySelector('main') || document.body;
        const textNodes = mainEl.querySelectorAll('p, pre, li');
        if (textNodes.length > 0) {
            console.warn('ChatBridge Groq: using last-resort full-page text extraction.');
            // We can't reliably assign roles here — mark as user with a note
            const combined = Array.from(textNodes)
                .map(n => n.innerText.trim())
                .filter(Boolean)
                .join('\n');
            if (combined.length > 0) {
                messages.push({
                    role:    'user',
                    content: '[NOTE: ChatBridge could not determine message roles. Raw text below:]\n\n' + combined
                });
            }
        }

        console.error('ChatBridge Groq: all strategies exhausted.');
        return buildSession();
    };

    // ── Listen for SCRAPE_CHAT messages ──────────────────────────────────────
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'SCRAPE_CHAT') {
            window.__chatbridge.scrapeChat()
                .then(session => sendResponse({ success: true, session }))
                .catch(err   => sendResponse({ success: false, error: err.message }));
            return true;
        }
    });
})();