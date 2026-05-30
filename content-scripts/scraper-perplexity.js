(function() {
  window.__chatbridge = window.__chatbridge || {};

  window.__chatbridge.scrapeChat = function() {
    const messages = [];

    // User messages
    document.querySelectorAll('[data-testid="user-message"], .whitespace-pre-line').forEach(el => {
      const text = el.innerText.trim();
      if (text) messages.push({ role: 'user', content: text });
    });

    // Assistant answers — Perplexity renders answers in .prose divs
    // We interleave by DOM order instead
    messages.length = 0; // Reset and do ordered pass

    const allTurns = document.querySelectorAll(
      '[data-testid="user-message"], .prose.dark\\:prose-invert'
    );

    allTurns.forEach(el => {
      const isUser = el.matches('[data-testid="user-message"]');
      const text = el.innerText.trim();
      if (text) messages.push({ role: isUser ? 'user' : 'assistant', content: text });
    });

    return { provider: 'perplexity', url: location.href, title: document.title, messages, capturedAt: new Date().toISOString() };
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'SCRAPE_CHAT') sendResponse({ success: true, session: window.__chatbridge.scrapeChat() });
    return true;
  });
})();