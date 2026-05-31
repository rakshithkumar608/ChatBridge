(function() {
    window.__chatbridge = window.__chatbridge || {};

    const INPUT_SELECTORS = {
    claude:     'div[contenteditable="true"].ProseMirror, div[contenteditable="true"][data-testid], div[contenteditable="true"]',
    chatgpt:    '#prompt-textarea, textarea[data-id="root"]',
    gemini:     'div[contenteditable="true"][aria-label], div.ql-editor, rich-textarea div[contenteditable="true"], div[contenteditable="true"]',
    groq:       'textarea#chat-input, textarea[placeholder*="message" i], textarea[placeholder*="ask" i], textarea',
    deepseek:   'textarea#chat-input, div[contenteditable="true"]',
    perplexity: 'textarea[placeholder="Ask anything..."], textarea',
    mistral:    'textarea[placeholder], div[contenteditable="true"]',
    grok:       'textarea[placeholder*="message" i], textarea[placeholder*="ask" i], div[contenteditable="true"][role="textbox"], textarea',
    cohere:     'textarea[placeholder], div[contenteditable="true"]',
    meta:       'div[contenteditable="true"][role="textbox"], textarea',
    copilot:    'textarea#userInput, div[contenteditable="true"]',
    poe:        'textarea.GrowingTextArea_textArea__ZWQbP, div[contenteditable="true"]'
    };

    const SUBMIT_SELECTORS = {
        claude:     'button[aria-label="Send Message"], button[data-testid="send-button"], button[type="submit"]',
    chatgpt:    'button[data-testid="send-button"], button[aria-label="Send prompt"]',
    gemini:     'button[aria-label="Send message"], button.send-button, button[mat-icon-button]',
    groq:       'button[type="submit"], button[aria-label="Send"], button[aria-label*="send" i]',
    deepseek:   'button[aria-label="send"], div[role="button"].send-button',
    perplexity: 'button[aria-label="Submit"], button[type="submit"]',
    mistral:    'button[type="submit"], button[data-testid="send-button"]',
    grok:       'button[aria-label="Send"], button[type="submit"]',
    cohere:     'button[aria-label="send message"], button[type="submit"]',
    meta:       'button[aria-label="Send message"], div[role="button"]',
    copilot:    'button[aria-label="Submit message"], button[type="submit"]',
    poe:        'button.ChatMessageSendButton_sendButton__4ZyI4, button[class*="sendButton"]'
    };

    async function injectPrompt(text, autoSubmit = false) {
        const provider = window.__chatbridge.provider || 'unknown';
        const selector = INPUT_SELECTORS[provider];
        if (!selector) return { success: false, error: 'Unknown provider' };

        // Wait for input to appear (page may still be loading)
        const input = await waitForElement(selector, 5000);
        if (!input) return {
            success: false,
            error: 'Input not found'
        };

        input.focus();

        if (input.tagName === 'TEXTAREA') {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
            nativeSetter.call(input, text);
            input.dispatchEvent(new Event('input', {
                bubbles: true
            }));
        } else {
            // contenteditable div (Claude, Gemini)
            input.innerHTML = '';
            document.execCommand('insertText', false, text);
            input.dispatchEvent(new Event('input', {
                bubbles: true
            }));
        }

        if (autoSubmit) {
            await new Promise(r => setTimeout(r, 500));
            const submitBtn = document.querySelector(SUBMIT_SELECTORS[provider]);
            if (submitBtn) submitBtn.click();
        }
        return {
            success: true
        }
    }


    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve) => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);

            const observer = new MutationObserver(() => {
                const found = document.querySelector(selector);
                if (found) {
                    observer.disconnect();
                    resolve(found);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            setTimeout(() => {
                observer.disconnect();
                resolve(null);
                }, timeout);
            });
        }

        window.__chatbridge.injectPrompt = injectPrompt;

        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.action === 'INJECT_PROMPT') {
                injectPrompt(msg.text, msg.autoSubmit || false)
                .then(sendResponse);
            }
            return true;
        })
})();