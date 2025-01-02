// background.js
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Function to capture screenshot
async function captureScreenshot(tabId) {
    try {
        // Inject html2canvas
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['html2canvas.min.js']
        });

        // Execute the capture
        const result = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: async () => {
                const element = document.querySelector('div[class*="ObjectIdentification"]');
                if (!element) {
                    throw new Error('Target element not found');
                }

                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: true,
                    backgroundColor: null
                });

                return canvas.toDataURL('image/png');
            }
        });

        if (!result || !result[0] || !result[0].result) {
            throw new Error('Failed to capture screenshot');
        }

        return result[0].result;
    } catch (error) {
        console.error('Capture error:', error);
        throw error;
    }
}

// Function to analyze image
// background.js
async function analyzeImage(base64Image) {
    try {
        const apiKey = await new Promise((resolve) => {
            chrome.storage.local.get(['geminiApiKey'], function(result) {
                resolve(result.geminiApiKey);
            });
        });

        if (!apiKey) {
            throw new Error('API key not found');
        }

        // Updated prompt to be more explicit about checking each image
        const prompt = `
            This is a grid of 6 images (3 rows x 2 columns), numbered 1 to 6 from left to right, top to bottom.
            Systematically check EACH image (1,2,3,4,5,6) for cats.
            
            Steps:
            1. Look at image 1. Does it have a cat? Include 1 if yes.
            2. Look at image 2. Does it have a cat? Include 2 if yes.
            3. Look at image 3. Does it have a cat? Include 3 if yes.
            4. Look at image 4. Does it have a cat? Include 4 if yes.
            5. Look at image 5. Does it have a cat? Include 5 if yes.
            6. Look at image 6. Does it have a cat? Include 6 if yes.

            Respond ONLY with numbers in parentheses, separated by commas, for ALL images containing cats.
            Example formats:
            - If all images have cats: (1,2,3,4,5,6)
            - If only images 1,3,5 have cats: (1,3,5)
            - If only image 4 has a cat: (4)

            Important: Check each image individually and don't skip any numbers.
        `;

        const response = await fetch(`${API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: "image/png",
                                data: base64Image.split(',')[1]
                            }
                        }
                    ]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        let result = data.candidates[0].content.parts[0].text.trim();

        // Clean up the response
        result = result.replace(/\s+/g, ''); // Remove whitespace

        // Validate the response format
        const numbers = result.match(/\d+/g);
        if (numbers) {
            // Sort numbers to ensure they're in order
            const sortedNumbers = numbers.map(Number).sort((a, b) => a - b);
            return `(${sortedNumbers.join(',')})`;
        }

        return result;
    } catch (error) {
        throw error;
    }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "takeScreenshot") {
        console.log('Taking screenshot...');
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            try {
                const base64Image = await captureScreenshot(tabs[0].id);
                const analysis = await analyzeImage(base64Image);
                
                // Send result back to sidebar
                chrome.runtime.sendMessage({
                    type: 'analysisResult',
                    result: analysis
                });
            } catch (error) {
                chrome.runtime.sendMessage({
                    type: 'error',
                    error: error.message
                });
            }
        });
    }
});