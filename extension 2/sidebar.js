document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyBtn = document.getElementById('saveKey');
    const captureBtn = document.getElementById('captureBtn');
    const statusDiv = document.getElementById('status');
    const resultDiv = document.getElementById('result');

    // Load saved API key
    chrome.storage.local.get(['geminiApiKey'], function(result) {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
    });

    // Save API key
    saveKeyBtn.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.local.set({ geminiApiKey: apiKey }, function() {
                statusDiv.textContent = 'API key saved!';
                setTimeout(() => statusDiv.textContent = '', 2000);
            });
        }
    });

    // Capture and analyze button
    captureBtn.addEventListener('click', function() {
        statusDiv.textContent = 'Capturing screenshot...';
        
        // Send message to content script to capture screenshot
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "captureScreenshot"});
        });
    });

    // Listen for analysis results
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        if (message.type === 'analysisResult') {
            statusDiv.textContent = 'Analysis complete!';
            resultDiv.textContent = message.result;
        } else if (message.type === 'error') {
            statusDiv.className = 'error';
            statusDiv.textContent = 'Error: ' + message.error;
        }
    });
});