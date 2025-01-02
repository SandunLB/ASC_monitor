// background.js
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

async function captureScreenshot(tabId, selector) {
    try {
        // Inject html2canvas
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['html2canvas.min.js']
        });

        // Execute the capture for the specific selector
        const result = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: async (selector) => {
                const element = document.querySelector(selector);
                if (!element) {
                    return null; // Return null if element not found
                }

                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: true,
                    backgroundColor: null
                });

                return canvas.toDataURL('image/png');
            },
            args: [selector]
        });

        if (!result || !result[0] || result[0].result === null) {
            return null;
        }

        return result[0].result;
    } catch (error) {
        console.error('Capture error:', error);
        throw error;
    }
}

async function clickGridImages(tabId, indices) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (indices) => {
                // First click the grid images
                const grid = document.querySelector('[class*="ObjectIdentificationstyle__ObjectIdentificationGrid"]');
                if (grid) {
                    const images = grid.querySelectorAll('img');
                    indices.forEach(index => images[index - 1]?.click());
                    
                    // Then click the verify button after a short delay
                    setTimeout(() => {
                        const verifyButton = document.querySelector('button[data-t="send-moderation-button"]');
                        if (verifyButton) {
                            verifyButton.click();
                        } else {
                            console.error("Verify button not found");
                        }
                    }, 500); // 500ms delay to ensure images are clicked first
                } else {
                    console.error("Grid element not found.");
                }
            },
            args: [indices]
        });
    } catch (error) {
        console.error('Click error:', error);
        throw error;
    }
}

async function analyzeGridImage(base64Image) {
    try {
        const apiKey = await new Promise((resolve) => {
            chrome.storage.local.get(['geminiApiKey'], function(result) {
                resolve(result.geminiApiKey);
            });
        });

        if (!apiKey) {
            throw new Error('API key not found');
        }

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

        // Extract numbers from the response
        const numbers = result.match(/\d+/g);
        if (numbers) {
            // Sort numbers and return both formatted string and array
            const sortedNumbers = numbers.map(Number).sort((a, b) => a - b);
            return {
                formatted: `(${sortedNumbers.join(',')})`,
                indices: sortedNumbers
            };
        }

        return {
            formatted: result,
            indices: []
        };
    } catch (error) {
        throw error;
    }
}

async function analyzeDescriptionImage(base64Image) {
    try {
        const apiKey = await new Promise((resolve) => {
            chrome.storage.local.get(['geminiApiKey'], function(result) {
                resolve(result.geminiApiKey);
            });
        });

        if (!apiKey) {
            throw new Error('API key not found');
        }

        const prompt = `
            View this image as if you're standing 20 meters away.
            List only the key visible elements you can see.
            Format your response exactly like this example: (doctor,smiling,hand,headset,green)
            Use only simple, single words separated by commas within parentheses.
            Do not include any other text or explanations.
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
        
        // Clean up response to ensure format
        result = result.replace(/\s+/g, '');
        if (!result.startsWith('(')) result = '(' + result;
        if (!result.endsWith(')')) result = result + ')';
        
        return result;
    } catch (error) {
        throw error;
    }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "takeScreenshot") {
        console.log('Starting analysis process...');
        
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            try {
                // First capture and analyze grid
                const gridImage = await captureScreenshot(tabs[0].id, 'div[class*="ObjectIdentification"]');
                let finalResult = {};
                
                if (gridImage) {
                    const gridAnalysis = await analyzeGridImage(gridImage);
                    finalResult.gridResult = gridAnalysis.formatted;
                    
                    // Click the images based on the analysis result
                    await clickGridImages(tabs[0].id, gridAnalysis.indices);
                }

                // Then try to capture and analyze description image if it exists
                const descImage = await captureScreenshot(tabs[0].id, 'div[class*="Captionstyle__StyledImage"] img');
                if (descImage) {
                    const descAnalysis = await analyzeDescriptionImage(descImage);
                    finalResult.descriptionResult = descAnalysis;
                }

                // Send combined results
                chrome.runtime.sendMessage({
                    type: 'analysisResult',
                    result: finalResult
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