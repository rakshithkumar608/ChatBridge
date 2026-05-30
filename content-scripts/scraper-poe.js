(function() {
  window.__chatbridge = window.__chatbridge || {};

  window.__chatbridge.scrapeChat = function() {
    const messages = [];

    // Poe uses hashed class names — we match by partial class name
    const allMessages = document.querySelectorAll('[class*="Message_row"]');

    allMessages.forEach(row => {
      const isUser = row.className.includes('humanMessage') || row.className.includes('human');
      const textEl = row.querySelector('[class*="bubble"] p, [class*="content"] p, p');
      const text = textEl ? textEl.innerText.trim() : '';

      if (text) messages.push({ role: isUser ? 'user' : 'assistant', content: text });
    });

    return { provider: 'poe', url: location.href, title: document.title, messages, capturedAt: new Date().toISOString() };
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'SCRAPE_CHAT') sendResponse({ success: true, session: window.__chatbridge.scrapeChat() });
    return true;
  });
})();