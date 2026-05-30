(function() {
  window.__chatbridge = window.__chatbridge || {};

  window.__chatbridge.scrapeChat = function() {
    const messages = [];

    // DeepSeek uses dynamic class names — we target by structure/role
    const turns = document.querySelectorAll('[class*="chat-message"], [class*="message-item"]');

    turns.forEach((turn) => {
      const isUser = turn.querySelector('[class*="user"], [class*="human"]') !== null
                  || turn.getAttribute('data-role') === 'user';
      const textEl = turn.querySelector('[class*="content"], [class*="text"], .markdown, p');
      const text = textEl ? textEl.innerText.trim() : '';

      if (text) messages.push({ role: isUser ? 'user' : 'assistant', content: text });
    });

    return { provider: 'deepseek', url: location.href, title: document.title, messages, capturedAt: new Date().toISOString() };
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'SCRAPE_CHAT') sendResponse({ success: true, session: window.__chatbridge.scrapeChat() });
    return true;
  });
})();