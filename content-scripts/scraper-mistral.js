(function() {
  window.__chatbridge = window.__chatbridge || {};

  window.__chatbridge.scrapeChat = function() {
    const messages = [];

    const turns = document.querySelectorAll(
      '[class*="human-turn"], [class*="assistant-turn"], [data-role="user"], [data-role="assistant"]'
    );

    turns.forEach(turn => {
      const isUser = turn.classList.toString().includes('human') 
                  || turn.getAttribute('data-role') === 'user';
      const textEl = turn.querySelector('.content, p, .markdown-content');
      const text = textEl ? textEl.innerText.trim() : turn.innerText.trim();

      if (text) messages.push({ role: isUser ? 'user' : 'assistant', content: text });
    });

    return { provider: 'mistral', url: location.href, title: document.title, messages, capturedAt: new Date().toISOString() };
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'SCRAPE_CHAT') sendResponse({ success: true, session: window.__chatbridge.scrapeChat() });
    return true;
  });
})();