function updateDisplay(value, page = '', status = '') {
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
  
  const pageText = page === 'review' ? 'Review Page' : 'New Page';
  statusElement.textContent = status || `Monitoring ${pageText}`;
}

function updateAccountDetails(details) {
  const nameElement = document.getElementById('accountName');
  const emailElement = document.getElementById('accountEmail');
  
  if (details) {
      nameElement.querySelector('span').textContent = details.accountName;
      emailElement.querySelector('span').textContent = details.accountEmail;
  }
}

window.addEventListener('load', () => {
  chrome.runtime.sendMessage({ action: "panelOpened" });
});

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "valueUpdated" || request.action === "contentUpdated") {
      updateDisplay(request.value, request.page);
  } else if (request.action === "accountDetailsUpdated") {
      updateAccountDetails(request.details);
  }
});

chrome.storage.local.get(['buttonValue', 'lastUpdate', 'accountDetails', 'currentPage'], (result) => {
  if (result.buttonValue) {
      updateDisplay(result.buttonValue, result.currentPage);
  } else {
      updateDisplay('Loading...', 'review', 'Navigating to Adobe Stock...');
  }
  
  if (result.accountDetails) {
      updateAccountDetails(result.accountDetails);
  }
});