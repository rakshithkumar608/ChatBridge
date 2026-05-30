(function() {
    window.__chatbridge = window.__chatbridge || {};

    const INPUT_SELECTORS = {
    claude:     'div[contenteditable="true"].ProseMirror, textarea[data-testid="chat-input"]',
  chatgpt:    '#prompt-textarea, textarea[data-id="root"]',
  gemini:     'div[contenteditable="true"].ql-editor, rich-textarea .ql-editor',
  groq:       'textarea[placeholder], div[contenteditable="true"]',
  deepseek:   'textarea#chat-input, div[contenteditable="true"]',
  perplexity: 'textarea[placeholder="Ask anything..."], textarea.overflow-auto',
  mistral:    'textarea[placeholder], div[contenteditable="true"]',
  grok:       'textarea[data-testid="tweetTextarea_0"], div[contenteditable="true"]',
  cohere:     'textarea[placeholder], div[contenteditable="true"]',
  meta:       'div[contenteditable="true"][role="textbox"], textarea',
  copilot:    'textarea#userInput, div[contenteditable="true"]',
  poe:        'textarea.GrowingTextArea_textArea__ZWQbP, div[contenteditable="true"]'
    };

    const SUBMIT_SELECTORS = {
        claude:     'button[aria-label="Send Message"], button[data-testid="send-button"]',
  chatgpt:    'button[data-testid="send-button"], button[aria-label="Send prompt"]',
  gemini:     'button[aria-label="Send message"], .send-button',
  groq:       'button[type="submit"], button[aria-label="Send"]',
  deepseek:   'button[aria-label="send"], div[role="button"].send-button',
  perplexity: 'button[aria-label="Submit"], button.bg-super',
  mistral:    'button[type="submit"], button[data-testid="send-button"]',
  grok:       'button[data-testid="tweetButton"], button[aria-label="Send"]',
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


    function waitForElement(selector, timeout = 3000) {
        return new Promise((resolve) => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);

            const observer = new MutationObserver(() => {
                const found = document.wuerySelector(selector);
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
})