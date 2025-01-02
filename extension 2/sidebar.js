// sidebar.js
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
                statusDiv.className = 'text-green-600';
                setTimeout(() => {
                    statusDiv.textContent = '';
                    statusDiv.className = '';
                }, 2000);
            });
        }
    });

    // Capture and analyze button
    captureBtn.addEventListener('click', function() {
        statusDiv.textContent = 'Analyzing images...';
        statusDiv.className = 'text-blue-600';
        
        // Send message to content script to capture screenshot
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "captureScreenshot"});
        });
    });

    // Listen for analysis results
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        if (message.type === 'analysisResult') {
            statusDiv.textContent = 'Analysis complete!';
            statusDiv.className = 'text-green-600';
            displayResults(resultDiv, message.result);
            setTimeout(() => {
                statusDiv.textContent = '';
                statusDiv.className = '';
            }, 2000);
        } else if (message.type === 'error') {
            statusDiv.textContent = 'Error: ' + message.error;
            statusDiv.className = 'text-red-600';
        }
    });

    function displayResults(resultDiv, data) {
        let html = '';
        
        if (data.gridResult) {
            html += `
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Cat Images:</label>
                    <div class="p-3 bg-gray-50 rounded border border-gray-200">${data.gridResult}</div>
                </div>
            `;
        }
        
        if (data.descriptionResult) {
            html += `
                <div class="mt-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Image Description:</label>
                    <div class="p-3 bg-gray-50 rounded border border-gray-200">${data.descriptionResult}</div>
                </div>
            `;
        }

        resultDiv.innerHTML = html;
    }
});