// Function to update the displayed value and timestamp
function updateDisplay(value, status = '') {
  const valueElement = document.getElementById('currentValue');
  const timestampElement = document.getElementById('timestamp');
  const statusElement = document.getElementById('status');
  
  if (value === 'Loading...') {
    valueElement.classList.add('loading');
  } else {
    valueElement.classList.remove('loading');
  }
  
  valueElement.textContent = value;
  timestampElement.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
  statusElement.textContent = status;
}

// Notify background script when panel is opened
window.addEventListener('load', () => {
  chrome.runtime.sendMessage({ action: "panelOpened" });
});

// Listen for updates from both background script and content script
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "valueUpdated" || request.action === "contentUpdated") {
    updateDisplay(request.value);
  }
});

// Load initial value from storage
chrome.storage.local.get(['buttonValue', 'lastUpdate'], (result) => {
  if (result.buttonValue) {
    updateDisplay(result.buttonValue);
  } else {
    updateDisplay('Loading...', 'Navigating to Adobe Stock...');
  }
});