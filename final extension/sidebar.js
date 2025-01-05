// sidebar.js
document.addEventListener('DOMContentLoaded', function() {
    // Element References
    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyBtn = document.getElementById('saveKey');
    const statusDiv = document.getElementById('status');
    const errorDiv = document.getElementById('error');
    const accountInfoDiv = document.getElementById('accountInfo');
    const currentPageDiv = document.getElementById('currentPage');
    const buttonValueDiv = document.getElementById('buttonValue');
    const lastUpdateDiv = document.getElementById('lastUpdate');
    const gridResultDiv = document.getElementById('gridResult');
    const descriptionResultDiv = document.getElementById('descriptionResult');

    // Load saved API key
    chrome.storage.local.get(['geminiApiKey'], function(result) {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
            showStatus('API key loaded', 'text-green-600');
        }
    });

    // Load saved state
    loadSavedState();

    // Save API key
    saveKeyBtn.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.local.set({ geminiApiKey: apiKey }, function() {
                showStatus('API key saved!', 'text-green-600');
            });
        } else {
            showError('Please enter an API key');
        }
    });

    // Notify background script that panel is opened
    chrome.runtime.sendMessage({ action: "panelOpened" });

    // Status update functions
    function showStatus(message, className = 'text-blue-600') {
        statusDiv.textContent = message;
        statusDiv.className = `text-center text-sm ${className} fade-in`;
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'text-center text-sm';
        }, 3000);
    }

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.className = 'text-center text-sm text-red-600 fade-in';
        setTimeout(() => {
            errorDiv.textContent = '';
            errorDiv.className = 'text-center text-sm text-red-600';
        }, 3000);
    }

    // Load saved state
    function loadSavedState() {
        chrome.storage.local.get([
            'accountDetails',
            'buttonValue',
            'currentPage',
            'lastUpdate'
        ], function(result) {
            updateAccountInfo(result.accountDetails);
            updateButtonValue(result.buttonValue);
            updateCurrentPage(result.currentPage);
            updateLastUpdate(result.lastUpdate);
        });
    }

    // Update UI functions
    function updateAccountInfo(details) {
        if (details) {
            accountInfoDiv.innerHTML = `
                <div class="font-medium">Account:</div>
                <div>${details.accountName || 'N/A'}</div>
                <div class="text-xs text-gray-500">${details.accountEmail || ''}</div>
            `;
        }
    }

    function updateButtonValue(value) {
        if (value) {
            buttonValueDiv.innerHTML = `
                <div class="font-medium">Current Count:</div>
                <div>${value}</div>
            `;
        }
    }

    function updateCurrentPage(page) {
        if (page) {
            currentPageDiv.innerHTML = `
                <div class="font-medium">Current Page:</div>
                <div>${page.charAt(0).toUpperCase() + page.slice(1)}</div>
            `;
        }
    }

    function updateLastUpdate(timestamp) {
        if (timestamp) {
            const date = new Date(timestamp);
            lastUpdateDiv.innerHTML = `
                <div class="font-medium">Last Updated:</div>
                <div>${date.toLocaleTimeString()}</div>
            `;
        }
    }

    function updateAnalysisResults(results) {
        if (results.gridResult) {
            gridResultDiv.innerHTML = `
                <div class="font-medium">Cat Images:</div>
                <div>${results.gridResult}</div>
            `;
        }
        if (results.descriptionResult) {
            descriptionResultDiv.innerHTML = `
                <div class="font-medium">Description:</div>
                <div>${results.descriptionResult}</div>
            `;
        }
    }

    // Message Listeners
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        if (message.type === 'analysisResult') {
            showStatus('Analysis complete!', 'text-green-600');
            updateAnalysisResults(message.result);
        }
        else if (message.type === 'error') {
            showError(message.error);
        }
        else if (message.action === "valueUpdated") {
            updateButtonValue(message.value);
            updateCurrentPage(message.page);
            updateLastUpdate(message.timestamp);
        }
        else if (message.action === "accountDetailsUpdated") {
            updateAccountInfo(message.details);
        }
    });

    // Refresh state every minute
    setInterval(loadSavedState, 60000);
});