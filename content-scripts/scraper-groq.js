(function() {
  window.__chatbridge = window.__chatbridge || {};

  window.__chatbridge.scrapeChat = async function() {
    const messages = [];

    try {
      // --- Strategy 1: Intercept network history from Groq's internal state ---
      // Groq stores messages in React fiber state. We try to extract them.
      // Look for the main chat container and walk the React fiber tree.
      const findReactFiber = (el) => {
        const key = Object.keys(el).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
        return key ? el[key] : null;
      };

      const extractMessagesFromFiber = (fiber) => {
        const msgs = [];
        let node = fiber;
        const MAX_DEPTH = 200;
        let depth = 0;

        while (node && depth < MAX_DEPTH) {
          depth++;
          const props = node.memoizedProps || node.pendingProps;
          if (props) {
            // Look for message arrays in props
            if (props.messages && Array.isArray(props.messages)) {
              props.messages.forEach(m => {
                if (m && m.role && m.content) {
                  msgs.push({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) });
                }
              });
              if (msgs.length > 0) return msgs;
            }
            // Look for chat/conversation in state
            if (props.chat && props.chat.messages) {
              props.chat.messages.forEach(m => {
                if (m && m.role && m.content) {
                  msgs.push({ role: m.role, content: m.content });
                }
              });
              if (msgs.length > 0) return msgs;
            }
          }
          node = node.child || node.sibling || (node.return ? node.return.sibling : null);
        }
        return msgs;
      };

      // Try to find message containers in the DOM to walk the React tree
      const msgContainers = document.querySelectorAll('main, #__next, [data-radix-scroll-area-viewport]');
      for (const container of msgContainers) {
        const fiber = findReactFiber(container);
        if (fiber) {
          const fiberMsgs = extractMessagesFromFiber(fiber);
          if (fiberMsgs.length > 0) {
            fiberMsgs.forEach(m => messages.push({ ...m, timestamp: Date.now() }));
            break;
          }
        }
      }

      if (messages.length > 0) {
        return buildSession();
      }
    } catch (e) {
      console.warn('ChatBridge Groq: React fiber strategy failed:', e.message);
    }

    // --- Strategy 2: DOM Selectors (multiple attempts) ---
    const selectorSets = [
      // Groq's known selectors
      '.message-row',
      '.human-turn',
      '.assistant-turn',
      // Generic markdown-based (Groq uses tailwind + prose like Claude)
      '.prose',
      // Role-based
      '[data-role="user"]',
      '[data-role="assistant"]',
      // Generic message containers
      '[class*="message"]',
      '[class*="Message"]',
    ];

    // Try interleaved approach: find all message-like blocks in DOM order
    const allPossible = document.querySelectorAll(
      '.message-row, [data-role], [class*="humanMessage"], [class*="assistantMessage"], ' +
      '[class*="human-message"], [class*="assistant-message"], ' +
      '[class*="user-message"], [class*="bot-message"]'
    );

    if (allPossible.length > 0) {
      allPossible.forEach(el => {
        const cls = (el.className || '').toLowerCase();
        const role = (cls.includes('human') || cls.includes('user')) ? 'user' : 'assistant';
        const text = el.innerText.trim();
        if (text) messages.push({ role, content: text, timestamp: Date.now() });
      });
    }

    if (messages.length === 0) {
      // Last resort: grab .prose blocks in DOM order as AI messages
      // and .whitespace-pre-wrap as user messages
      document.querySelectorAll('.prose, .whitespace-pre-wrap').forEach(node => {
        const isHuman = !node.classList.contains('prose') && !node.closest('.prose');
        const text = node.innerText.trim();
        if (text) messages.push({ role: isHuman ? 'user' : 'assistant', content: text, timestamp: Date.now() });
      });
    }

    return buildSession();

    function buildSession() {
      // Deduplicate consecutive same-role messages
      const clean = [];
      let lastRole = null;
      for (const m of messages) {
        if (m.role === lastRole) {
          clean[clean.length - 1].content += '\n\n' + m.content;
        } else {
          clean.push({ ...m });
          lastRole = m.role;
        }
      }
      return { provider: 'groq', url: location.href, title: document.title, messages: clean, capturedAt: new Date().toISOString() };
    }
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'SCRAPE_CHAT') {
      window.__chatbridge.scrapeChat()
        .then(session => sendResponse({ success: true, session }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }
  });
})();