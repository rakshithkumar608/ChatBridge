(function() {
    window.__chatbridge = window.__chatbridge || {};

    const ENHANCE_TEMPLATES = {
        clarity: (p) => `Please execute the following task with extreme clarity and precision.\n\n# Task\n${p}\n\n# Instructions\n- Break down the response into simple, easy-to-understand terms.\n- Avoid ambiguity, jargon, and ensure the core answer is straightforward.\n- Provide concrete examples where necessary to ensure crystal-clear understanding.`,
        detailed: (p) => `Please execute the following task by providing a highly detailed and comprehensive response.\n\n# Task\n${p}\n\n# Instructions\n- Cover all relevant edge cases, nuances, and background context related to the topic.\n- Provide step-by-step explanations and deep-dive into the underlying concepts.\n- Anticipate potential follow-up questions and address them proactively.`,
        structured: (p) => `Please execute the following task. Format your response strictly according to the structure requested below.\n\n# Task / Objective\n${p}\n\n# Guidelines\n1. Be highly organized, logical, and systematic in your approach.\n2. Use clear headings, bullet points, and markdown formatting for readability.\n3. Ensure all constraints are respected.\n\n# Desired Output Format\n- **Executive Summary:** A brief 1-2 sentence overview.\n- **Main Content:** The core answer or code, structured logically.\n- **Key Takeaways / Conclusion:** A brief summary of the most important points.`,
        concise: (p) => `Please execute the following task as concisely and directly as possible.\n\n# Task\n${p}\n\n# Instructions\n- Eliminate all fluff, filler words, and conversational pleasantries.\n- Get straight to the point immediately.\n- Provide the absolute minimum text required to answer accurately and completely.`
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