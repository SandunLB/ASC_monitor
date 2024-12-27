const REVIEW_URL = 'https://contributor.stock.adobe.com/en/uploads/review';
const NEW_URL = 'https://contributor.stock.adobe.com/en/uploads';
let currentValue = '';
let currentPage = 'review';

// Toggle side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    await chrome.sidePanel.setOptions({ 
      enabled: true,
      path: 'sidepanel.html'
    });
  } catch (error) {
    console.error("Error opening side panel:", error);
  }
});

// Enable side panel when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setOptions({
    enabled: true,
    path: 'sidepanel.html'
  });
});

async function switchToPage(url) {
  try {
    const tabs = await chrome.tabs.query({
      url: 'https://contributor.stock.adobe.com/en/uploads*'
    });

    if (tabs.length > 0) {
      await chrome.tabs.update(tabs[0].id, { url: url });
      setTimeout(fetchAndUpdateValue, 2000);
    } else {
      await chrome.tabs.create({ url: url });
      setTimeout(fetchAndUpdateValue, 2000);
    }
  } catch (error) {
    console.error("Error switching page:", error);
  }
}

async function fetchAndUpdateValue() {
  try {
    const tabs = await chrome.tabs.query({
      url: 'https://contributor.stock.adobe.com/en/uploads*'
    });

    if (tabs.length > 0) {
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: "getButtonValue"
      });

      if (response) {
        currentValue = response.value;
        const count = parseInt(response.value.match(/\((\d+)\)/)?.[1] || '0');
        
        if (currentPage === 'review' && count < 50) {
          currentPage = 'new';
          await switchToPage(NEW_URL);
        }
        else if (currentPage === 'new' && count > 0) {
          currentPage = 'review';
          await switchToPage(REVIEW_URL);
        }

        await chrome.storage.local.set({ 
          buttonValue: currentValue,
          lastUpdate: new Date().toISOString(),
          currentPage: currentPage
        });
        
        chrome.runtime.sendMessage({
          action: "valueUpdated",
          value: currentValue,
          page: currentPage,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error("Error fetching button value:", error);
  }
}

async function navigateAndGetValue() {
  try {
    await switchToPage(REVIEW_URL);
    currentPage = 'review';
  } catch (error) {
    console.error("Error navigating to page:", error);
  }
}

async function handleAccountDetails(details) {
  try {
    await chrome.storage.local.set({ 
      accountDetails: details,
      accountLastUpdate: new Date().toISOString()
    });
    
    chrome.runtime.sendMessage({
      action: "accountDetailsUpdated",
      details: details,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error handling account details:", error);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "panelOpened") {
    navigateAndGetValue();
  }
  
  if (request.action === "contentUpdated") {
    currentValue = request.value;
    chrome.storage.local.set({ 
      buttonValue: currentValue,
      lastUpdate: new Date().toISOString()
    });
    chrome.runtime.sendMessage({
      action: "valueUpdated",
      value: currentValue,
      page: currentPage,
      timestamp: new Date().toISOString()
    });
  }
  
  if (request.action === "accountDetailsUpdated") {
    handleAccountDetails(request.details);
  }
});

async function checkAndRefreshAccountDetails() {
  try {
    const tabs = await chrome.tabs.query({
      url: 'https://contributor.stock.adobe.com/en/uploads*'
    });

    if (tabs.length > 0) {
      await chrome.tabs.sendMessage(tabs[0].id, {
        action: "refreshAccountDetails"
      });
    }
  } catch (error) {
    console.error("Error refreshing account details:", error);
  }
}

setInterval(() => {
  fetchAndUpdateValue();
  checkAndRefreshAccountDetails();
}, 60000);

fetchAndUpdateValue();