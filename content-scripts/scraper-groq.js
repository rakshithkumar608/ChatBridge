(function() {
  window.__chatbridge = window.__chatbridge || {};

  window.__chatbridge.scrapeChat = function() {
    const messages = [];
    const turns = document.querySelectorAll('.message-row, [class*="message-row"]');

    turns.forEach((turn) => {
      const isUser = turn.querySelector('[class*="human"], [class*="user-message"]') !== null;
      const textEl = turn.querySelector('[class*="message-content"], p, .prose');
      const text = textEl ? textEl.innerText.trim() : turn.innerText.trim();

      if (text) messages.push({ role: isUser ? 'user' : 'assistant', content: text });
    });

    // Fallback: try role-labeled divs
    if (messages.length === 0) {
      document.querySelectorAll('[data-role]').forEach(el => {
        const role = el.getAttribute('data-role');
        const text = el.innerText.trim();
        if (text && (role === 'user' || role === 'assistant')) {
          messages.push({ role, content: text });
        }
      });
    }

    return { provider: 'groq', url: location.href, title: document.title, messages, capturedAt: new Date().toISOString() };
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'SCRAPE_CHAT') sendResponse({ success: true, session: window.__chatbridge.scrapeChat() });
    return true;
  });
})();