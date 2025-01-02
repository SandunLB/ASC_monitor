// content.js
function sendScreenshotRequest() {
    console.log('Sending screenshot request to background script');
    chrome.runtime.sendMessage({ action: "takeScreenshot" });
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "captureScreenshot") {
        console.log('Received capture request');
        sendScreenshotRequest();
    }
});