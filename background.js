let currentValue = '';
const TARGET_URL = 'https://contributor.stock.adobe.com/en/uploads/review';

// Toggle side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    // Set the extension as the active side panel
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

// Function to navigate to target URL and get initial value
async function navigateAndGetValue() {
  try {
    // Check if target page is already open
    const tabs = await chrome.tabs.query({
      url: TARGET_URL
    });

    if (tabs.length === 0) {
      // If not open, create new tab with target URL
      await chrome.tabs.create({ url: TARGET_URL });
      // Wait for page load and then get value
      setTimeout(fetchAndUpdateValue, 2000); // Wait 2 seconds for page to load
    } else {
      // If already open, just get the value
      await fetchAndUpdateValue();
    }
  } catch (error) {
    console.error("Error navigating to page:", error);
  }
}

// Function to send message to content script and update side panel
async function fetchAndUpdateValue() {
  try {
    const tabs = await chrome.tabs.query({
      url: TARGET_URL
    });

    if (tabs.length > 0) {
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: "getButtonValue"
      });

      if (response) {
        currentValue = response.value;
        await chrome.storage.local.set({ 
          buttonValue: currentValue,
          lastUpdate: new Date().toISOString()
        });
        
        // Broadcast the update to all listeners
        chrome.runtime.sendMessage({
          action: "valueUpdated",
          value: currentValue,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error("Error fetching button value:", error);
  }
}

// Listen for side panel opening
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "panelOpened") {
    navigateAndGetValue();
  }
  // Listen for content script updates
  if (request.action === "contentUpdated") {
    currentValue = request.value;
    chrome.storage.local.set({ 
      buttonValue: currentValue,
      lastUpdate: new Date().toISOString()
    });
    // Broadcast the update to side panel
    chrome.runtime.sendMessage({
      action: "valueUpdated",
      value: currentValue,
      timestamp: new Date().toISOString()
    });
  }
});

// Set up periodic fetching (every minute)
setInterval(fetchAndUpdateValue, 1000);

// Initial fetch when background script loads
fetchAndUpdateValue();