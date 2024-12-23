// Function to get button value
function getButtonValue() {
    const button = document.querySelector('[data-t="content-filter-menu"]');
    const buttonText = button?.querySelector('.button__text')?.textContent || '';
    return buttonText;
  }
  
  // Function to find account details in shadow DOMs
  function findAccountDetails() {
    // Function to search inside shadow DOMs
    function findInShadowRoots(root) {
      const nameElement = root.querySelector('h2[data-testid="account-menu-header-name"]');
      const emailElement = root.querySelector('p[data-testid="account-menu-header-email"]');
      
      if (nameElement && emailElement) {
        return {
          accountName: nameElement.textContent.trim(),
          accountEmail: emailElement.textContent.trim()
        };
      }
      
      // Search deeper in any shadow roots inside this shadow root
      const shadowHosts = root.querySelectorAll('*');
      for (let host of shadowHosts) {
        if (host.shadowRoot) {
          const result = findInShadowRoots(host.shadowRoot);
          if (result) return result;
        }
      }
      return null;
    }
  
    // Search in the main document body
    const nameElement = document.querySelector('h2[data-testid="account-menu-header-name"]');
    const emailElement = document.querySelector('p[data-testid="account-menu-header-email"]');
    
    if (nameElement && emailElement) {
      return {
        accountName: nameElement.textContent.trim(),
        accountEmail: emailElement.textContent.trim()
      };
    }
  
    // If not found, check in shadow DOMs of all elements
    const shadowRoots = document.querySelectorAll('*');
    for (let el of shadowRoots) {
      if (el.shadowRoot) {
        const result = findInShadowRoots(el.shadowRoot);
        if (result) return result;
      }
    }
    return null;
  }
  
  // Function to get and send account details
  function getAndSendAccountDetails() {
    const accountDetails = findAccountDetails();
    if (accountDetails) {
      chrome.runtime.sendMessage({
        action: "accountDetailsUpdated",
        details: accountDetails
      });
    }
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
  
  // Wait for page load and then get account details
  window.addEventListener('load', () => {
    setTimeout(getAndSendAccountDetails, 5000);
  });