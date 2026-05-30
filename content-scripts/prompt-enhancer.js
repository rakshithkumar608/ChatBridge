(function() {
    window.__chatbridge = window.__chatbridge || {};

    const ENHANCE_TEMPLATES = {
        clarity: (p) => `Please rewrite the following prompt to be clearer and more specific:\n\n"${p}"\n\nEnhanced version:`,
        detailed: (p) => `Expand this prompt with more context and detail:\n\n"${p}"`,
        structured: (p) => `Rewrite this as a well-structured prompt with clear objectives:\n\n"${p}"`,
        concise: (p) => `Make this prompt more concise while keeping all key information:\n\n"${p}"`
    };


    window.__chatbridge.enhancePrompt = function(promptText, mode = 'clarity') {
        const template = ENHANCE_TEMPLATES[mode] || ENHANCE_TEMPLATES.clarity;
        return template(promptText);
    };

    // Optional: Add a floating enhance button to the chat input
    function addEnhanceButton() {
        if (document.getElementById('chatbridge-enhance-btn')) return;


        const btn = document.createElement('button');
        btn.id = 'chatbridge-enhance-btn';
        btn.innerHTML = '✨ Enhance';
        btn.style.cssText = `
        position: fixed; bottom: 80px; right: 20px;
        background: #6c47ff; color: white; border: none;
        padding: 8px 14px; border-radius: 20px; cursor: pointer; font-size: 13px; z-index: 9999; box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: opacity 0.2s;
        `;

        btn.addEventListener('click', () => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'OPEN_ENHANCER'
                });
            } else {
                console.warn('ChatBridge: chrome.runtime not available');
            }
        });

        document.body.appendChild(btn);
    }

    // Inject button after page loads
    if (document.readyState === 'complete') addEnhanceButton();
    else window.addEventListener('load', addEnhanceButton);
})();