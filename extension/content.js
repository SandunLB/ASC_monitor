function getButtonValue() {
  const button = document.querySelector('[data-t="content-filter-menu"]');
  const buttonText = button?.querySelector('.button__text')?.textContent || '';
  const isReviewPage = window.location.pathname.includes('/review');
  return {
    value: buttonText,
    page: isReviewPage ? 'review' : 'new'
  };
}

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

const observer = new MutationObserver((mutations) => {
  const buttonInfo = getButtonValue();
  if (buttonInfo.value) {
    chrome.runtime.sendMessage({
      action: "contentUpdated",
      value: buttonInfo.value,
      page: buttonInfo.page
    });
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getButtonValue") {
    const buttonInfo = getButtonValue();
    sendResponse(buttonInfo);
  }
  if (request.action === "refreshAccountDetails") {
    getAndSendAccountDetails();
  }
  return true;
});

window.addEventListener('load', () => {
  setTimeout(getAndSendAccountDetails, 5000);
});