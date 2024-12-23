// Function to get button value
function getButtonValue() {
    const button = document.querySelector('[data-t="content-filter-menu"]');
    const buttonText = button?.querySelector('.button__text')?.textContent || '';
    return buttonText;
  }
  
  // Set up mutation observer to watch for changes
  const observer = new MutationObserver((mutations) => {
    const value = getButtonValue();
    if (value) {
      chrome.runtime.sendMessage({
        action: "contentUpdated",
        value: value
      });
    }
  });
  
  // Start observing the document with the configured parameters
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getButtonValue") {
      const value = getButtonValue();
      sendResponse({ value });
    }
    return true;
  });