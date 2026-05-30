(function() {
  window.__chatbridge = window.__chatbridge || {};

  window.__chatbridge.scrapeChat = function() {
    const messages = [];

    const turns = document.querySelectorAll(
      '[class*="user-query"], [class*="assistant-response"], [class*="MetaMessage"]'
    );

    turns.forEach(turn => {
      const isUser = turn.classList.toString().match(/user|human|query/i) !== null;
      const textEl = turn.querySelector('p, span, [class*="text"]');
      const text = textEl ? textEl.innerText.trim() : turn.innerText.trim();

      if (text) messages.push({ role: isUser ? 'user' : 'assistant', content: text });
    });

    return { provider: 'meta', url: location.href, title: document.title, messages, capturedAt: new Date().toISOString() };
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'SCRAPE_CHAT') sendResponse({ success: true, session: window.__chatbridge.scrapeChat() });
    return true;
  });
})();