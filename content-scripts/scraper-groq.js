(function() {
  window.__chatbridge = window.__chatbridge || {};

  window.__chatbridge.scrapeChat = function() {
    const messages = [];

    // grok.com structure
    const userMsgs = document.querySelectorAll('[data-testid="userMessage"], [class*="userMessage"]');
    const botMsgs  = document.querySelectorAll('[data-testid="botMessage"],  [class*="botMessage"]');

    // Interleave by DOM position
    const all = [...document.querySelectorAll(
      '[data-testid="userMessage"], [data-testid="botMessage"], [class*="userMessage"], [class*="botMessage"]'
    )];

    all.forEach(el => {
      const isUser = el.dataset.testid === 'userMessage' || el.className.includes('userMessage');
      const text = el.innerText.trim();
      if (text) messages.push({ role: isUser ? 'user' : 'assistant', content: text });
    });

    return { provider: 'groq', url: location.href, title: document.title, messages, capturedAt: new Date().toISOString() };
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'SCRAPE_CHAT') sendResponse({ success: true, session: window.__chatbridge.scrapeChat() });
    return true;
  });
})();