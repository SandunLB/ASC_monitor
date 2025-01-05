// content.js

// Button value monitoring
function getButtonValue() {
    const button = document.querySelector('[data-t="content-filter-menu"]');
    const buttonText = button?.querySelector('.button__text')?.textContent || '';
    const isReviewPage = window.location.pathname.includes('/review');
    return {
        value: buttonText,
        page: isReviewPage ? 'review' : 'new'
    };
}

// Account details retrieval
function findAccountDetails() {
    function findInShadowRoots(root) {
        const nameElement = root.querySelector('h2[data-testid="account-menu-header-name"]');
        const emailElement = root.querySelector('p[data-testid="account-menu-header-email"]');
        
        if (nameElement && emailElement) {
            return {
                accountName: nameElement.textContent.trim(),
                accountEmail: emailElement.textContent.trim()
            };
        }
        
        const shadowHosts = root.querySelectorAll('*');
        for (let host of shadowHosts) {
            if (host.shadowRoot) {
                const result = findInShadowRoots(host.shadowRoot);
                if (result) return result;
            }
        }
        return null;
    }

    const nameElement = document.querySelector('h2[data-testid="account-menu-header-name"]');
    const emailElement = document.querySelector('p[data-testid="account-menu-header-email"]');
    
    if (nameElement && emailElement) {
        return {
            accountName: nameElement.textContent.trim(),
            accountEmail: emailElement.textContent.trim()
        };
    }

    const shadowRoots = document.querySelectorAll('*');
    for (let el of shadowRoots) {
        if (el.shadowRoot) {
            const result = findInShadowRoots(el.shadowRoot);
            if (result) return result;
        }
    }
    return null;
}

function getAndSendAccountDetails() {
    const accountDetails = findAccountDetails();
    if (accountDetails) {
        chrome.runtime.sendMessage({
            action: "accountDetailsUpdated",
            details: accountDetails
        });
    }
}

// Screenshot and analysis support
function sendScreenshotRequest() {
    console.log('Sending screenshot request to background script');
    chrome.runtime.sendMessage({ action: "takeScreenshot" });
}

// Click simulation helpers
function simulateMouseClick(element) {
    if (element) {
        ['mousedown', 'mouseup', 'click'].forEach(eventType => {
            const event = new MouseEvent(eventType, {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1
            });
            element.dispatchEvent(event);
        });
    }
}

// Mutation observer for page changes
const observer = new MutationObserver((mutations) => {
    // Check for button value changes
    const buttonInfo = getButtonValue();
    if (buttonInfo.value) {
        chrome.runtime.sendMessage({
            action: "contentUpdated",
            value: buttonInfo.value,
            page: buttonInfo.page
        });
    }

    // Check for account details changes
    const accountDetails = findAccountDetails();
    if (accountDetails) {
        chrome.runtime.sendMessage({
            action: "accountDetailsUpdated",
            details: accountDetails
        });
    }

    // Check for specific elements that might need interaction
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // Look for specific elements that might need handling
                // This can be expanded based on needs
            }
        });
    });
});

// Configure and start the observer
observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'data-t']
});

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle button value requests
    if (request.action === "getButtonValue") {
        const buttonInfo = getButtonValue();
        sendResponse(buttonInfo);
        return true;
    }

    // Handle account detail refresh requests
    if (request.action === "refreshAccountDetails") {
        getAndSendAccountDetails();
        return true;
    }

    // Handle screenshot requests
    if (request.action === "captureScreenshot") {
        sendScreenshotRequest();
        return true;
    }

    // Handle element interaction requests
    if (request.action === "clickElement") {
        const element = document.querySelector(request.selector);
        if (element) {
            simulateMouseClick(element);
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Element not found' });
        }
        return true;
    }

    // Handle text input requests
    if (request.action === "inputText") {
        const element = document.querySelector(request.selector);
        if (element) {
            element.value = request.text;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Element not found' });
        }
        return true;
    }
});

// Initialize when page loads
window.addEventListener('load', () => {
    // Initial delay to ensure page is fully loaded
    setTimeout(() => {
        // Send initial button value
        const buttonInfo = getButtonValue();
        if (buttonInfo.value) {
            chrome.runtime.sendMessage({
                action: "contentUpdated",
                value: buttonInfo.value,
                page: buttonInfo.page
            });
        }

        // Send initial account details
        getAndSendAccountDetails();

        // Check for and handle any initial page state
        const currentUrl = window.location.href;
        chrome.runtime.sendMessage({
            action: "pageLoaded",
            url: currentUrl
        });
    }, 2000);
});

// Error handling
window.addEventListener('error', (event) => {
    console.error('Content script error:', event.error);
    chrome.runtime.sendMessage({
        action: "error",
        error: event.error.message
    });
});

// Cleanup when page unloads
window.addEventListener('unload', () => {
    observer.disconnect();
});