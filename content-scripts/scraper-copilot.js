(function() {
  window.__chatbridge = window.__chatbridge || {};

  window.__chatbridge.scrapeChat = function() {
    const messages = [];

    const turns = document.querySelectorAll(
      '[data-content="user-message"], [data-content="response"], [class*="user-message"], [class*="bot-message"]'
    );

    turns.forEach(turn => {
      const isUser = turn.getAttribute('data-content') === 'user-message'
                  || turn.classList.toString().includes('user');
      const textEl = turn.querySelector('p, [class*="text"], .content');
      const text = textEl ? textEl.innerText.trim() : turn.innerText.trim();

      if (text) messages.push({ role: isUser ? 'user' : 'assistant', content: text });
    });

    return { provider: 'copilot', url: location.href, title: document.title, messages, capturedAt: new Date().toISOString() };
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'SCRAPE_CHAT') sendResponse({ success: true, session: window.__chatbridge.scrapeChat() });
    return true;
  });
})();