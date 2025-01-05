// background.js
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const REVIEW_URL = 'https://contributor.stock.adobe.com/en/uploads/review';
const NEW_URL = 'https://contributor.stock.adobe.com/en/uploads';
let currentValue = '';
let currentPage = 'review';
let isProcessing = false;
let lastRefreshTime = 0;

// Toggle side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
    try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        await chrome.sidePanel.setOptions({ 
            enabled: true,
            path: 'sidebar.html'
        });
    } catch (error) {
        console.error("Error opening side panel:", error);
    }
});

// Enable side panel when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
    await chrome.sidePanel.setOptions({
        enabled: true,
        path: 'sidebar.html'
    });
});

async function captureScreenshot(tabId, selector) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['html2canvas.min.js']
        });

        const result = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: async (selector) => {
                const element = document.querySelector(selector);
                if (!element) return null;

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
            func: async (indices) => {
                const grid = document.querySelector('[class*="ObjectIdentificationstyle__ObjectIdentificationGrid"]');
                if (grid) {
                    const images = grid.querySelectorAll('img');
                    
                    const randomDelay = () => {
                        const min = 300;
                        const max = 1000;
                        return new Promise(resolve => 
                            setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min))
                        );
                    };
                    
                    for (let index of indices) {
                        const img = images[index - 1];
                        if (img) {
                            img.click();
                            await randomDelay();
                        }
                    }
                    
                    setTimeout(() => {
                        const verifyButton = document.querySelector('button[data-t="send-moderation-button"]');
                        if (verifyButton) {
                            verifyButton.click();
                        }
                    }, 500);
                }
            },
            args: [indices]
        });
    } catch (error) {
        console.error('Click error:', error);
        throw error;
    }
}

async function updateDescription(tabId, description) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: async (description) => {
                const randomDelay = (min, max) => {
                    return new Promise(resolve => 
                        setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min))
                    );
                };

                async function simulateHumanTyping(text) {
                    const textarea = document.querySelector('textarea[aria-label="Caption textarea"]');
                    if (!textarea) {
                        console.error('Textarea not found');
                        return;
                    }

                    let currentText = '';
                    const cleanText = text.replace(/[()]/g, '');

                    textarea.focus();

                    for (let char of cleanText) {
                        currentText += char;
                        textarea.value = currentText;
                        const inputEvent = new Event('input', { bubbles: true });
                        textarea.dispatchEvent(inputEvent);
                        await randomDelay(30, 150);
                        if (Math.random() < 0.1) {
                            await randomDelay(400, 800);
                        }
                    }

                    const changeEvent = new Event('change', { bubbles: true });
                    textarea.dispatchEvent(changeEvent);
                    await randomDelay(200, 500);
                    textarea.blur();

                    setTimeout(() => {
                        const verifyButton = document.querySelector('button[data-t="captcha-caption-continue"]');
                        if (verifyButton) {
                            verifyButton.click();
                        }
                    }, 500);
                }

                await simulateHumanTyping(description);
            },
            args: [description]
        });
    } catch (error) {
        console.error('Description update error:', error);
        throw error;
    }
}

async function switchToPage(url) {
    try {
        const tabs = await chrome.tabs.query({
            url: 'https://contributor.stock.adobe.com/en/uploads*'
        });

        if (tabs.length > 0) {
            await chrome.tabs.update(tabs[0].id, { url: url });
            setTimeout(() => {
                checkPageStateAndExecute(tabs[0].id);
            }, 5000);
        } else {
            const newTab = await chrome.tabs.create({ url: url });
            setTimeout(() => {
                checkPageStateAndExecute(newTab.id);
            }, 5000);
        }
    } catch (error) {
        console.error("Error switching page:", error);
    }
}

async function checkPageStateAndExecute(tabId) {
    try {
        if (isProcessing) return;

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
                
                if (currentPage === 'review' && count < 20) {
                    currentPage = 'new';
                    await switchToPage(NEW_URL);
                } 
                else if (currentPage === 'new') {
                    isProcessing = true;
                    await processWorkflow(tabId);
                    isProcessing = false;
                    
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
        isProcessing = false;
        console.error("Error in checkPageStateAndExecute:", error);
        chrome.runtime.sendMessage({
            type: 'error',
            error: error.message
        });
    }
}

async function processWorkflow(tabId) {
    try {
        await executeImageSelectionScript(tabId);
        await new Promise(resolve => setTimeout(resolve, 2000));

        let finalResult = {};
        let maxIterations = 10;
        let iteration = 0;

        while (iteration < maxIterations) {
            if (!isProcessing) break;

            const gridImage = await captureScreenshot(tabId, 'div[class*="ObjectIdentification"]');
            if (gridImage) {
                const gridAnalysis = await analyzeGridImage(gridImage);
                finalResult.gridResult = gridAnalysis.formatted;
                await clickGridImages(tabId, gridAnalysis.indices);
                await new Promise(resolve => setTimeout(resolve, 2000));
                iteration++;
                continue;
            }

            const descImage = await captureScreenshot(tabId, 'div[class*="Captionstyle__StyledImage"] img');
            if (descImage) {
                const descAnalysis = await analyzeDescriptionImage(descImage);
                finalResult.descriptionResult = descAnalysis;
                await updateDescription(tabId, descAnalysis);
                await new Promise(resolve => setTimeout(resolve, 2000));
                iteration++;
                continue;
            }

            const finalSubmitButton = await checkElementExists(tabId, 'button[data-t="send-moderation-button"]');
            if (finalSubmitButton) {
                await clickFinalSubmitButton(tabId);
                break;
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
            iteration++;
        }

        chrome.runtime.sendMessage({
            type: 'analysisResult',
            result: finalResult
        });

    } catch (error) {
        console.error('Workflow error:', error);
        throw error;
    }
}

async function checkElementExists(tabId, selector) {
    try {
        const result = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (selector) => {
                return document.querySelector(selector) !== null;
            },
            args: [selector]
        });
        return result[0].result;
    } catch (error) {
        console.error('Element existence check error:', error);
        return false;
    }
}

async function executeImageSelectionScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: async () => {
                // First execute the provided script
                ['div.text-sregular.margin-left-xsmall.left', 
                 'div[data-t="asset-sidebar-submission-checkbox"] label', 
                 'div.text-sregular.margin-left-xsmall.left'].forEach((selector, i) => 
                    setTimeout(() => {
                        const element = document.querySelector(selector);
                        if (element) {
                            element.click();
                            console.log(`Clicked element with selector: ${selector}`);
                        } else {
                            console.error(`Element not found for selector: ${selector}`);
                        }
                    }, i * 500)
                );

                // Wait for the above script to complete (3 * 500ms = 1500ms + buffer)
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Continue with the original image selection flow
                const containers = document.querySelectorAll('.container-inline-block');
                const startIndex = 0, numberOfSelections = 1;
                
                const clickCheckboxByText = (text, delay = 0) => {
                    setTimeout(() => {
                        const checkbox = Array.from(document.querySelectorAll('label'))
                            .find(label => label.textContent.trim() === text)
                            ?.querySelector('input[type="checkbox"]');
                        if (checkbox) checkbox.click();
                    }, delay);
                };

                [...containers].slice(startIndex, startIndex + numberOfSelections).forEach(container => {
                    container.querySelector('img.upload-tile__thumbnail')
                        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
                });

                // Wait for initial selection to process
                setTimeout(() => {
                    // Click the sidebar submission checkbox
                    const sidebarCheckbox = document.querySelector('div[data-t="asset-sidebar-submission-checkbox"] label');
                    if (sidebarCheckbox) {
                        sidebarCheckbox.click();
                        console.log('Sidebar checkbox clicked');
                    }

                    // Wait before clicking submit button
                    setTimeout(() => {
                        const submitButton = document.querySelector('button[data-t="submit-moderation-button"]');
                        if (submitButton) {
                            submitButton.click();
                            console.log('Submit button clicked');

                            // Handle the post-submit actions
                            setTimeout(() => {
                                clickCheckboxByText('I reviewed the submission guidelines and confirm in particular that:');
                                clickCheckboxByText('I understand that my account can be suspended if I breach the guidelines.', 500);

                                setTimeout(() => {
                                    const continueButton = document.querySelector('button[data-t="continue-moderation-button"]');
                                    if (continueButton) {
                                        continueButton.click();
                                        console.log('Continue button clicked');
                                    }
                                }, 1000);
                            }, 1000);
                        }
                    }, 1000);
                }, 1000);
            }
        });
    } catch (error) {
        console.error('Image selection script error:', error);
        throw error;
    }
}

async function clickFinalSubmitButton(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: async () => {
                const finalSubmitButton = document.querySelector('button[data-t="send-moderation-button"]');
                if (finalSubmitButton) {
                    finalSubmitButton.click();
                }
            }
        });
    } catch (error) {
        console.error('Final submit button click error:', error);
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
            Your task is to determine which images contain cats. 

            **Steps to Ensure 100% Accuracy**:
            1. For each image (1 to 6), perform an initial analysis and record your findings.
            2. Reanalyze the same image TWO MORE TIMES to confirm your result. If there is any doubt during any pass, mark the image as containing a cat.
            3. After analyzing all six images, cross-check your results from all passes for consistency. If any pass suggests a cat, include the image number.
            4. After completing all steps, respond ONLY with numbers in parentheses, separated by commas, for all images containing cats.

            **Response Format**:
            - If all images have cats: (1,2,3,4,5,6)
            - If only images 1,3,5 have cats: (1,3,5)
            - If only image 4 has a cat: (4)
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
        result = result.replace(/\s+/g, '');

        const numbers = result.match(/\d+/g);
        if (numbers) {
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
            
            **Important Instructions**:
            - Your response MUST include AT LEAST six (6) distinct words.
            - Format your response exactly like this example: (doctor,smiling,hand,headset,green,chair)
            - Use only simple, single words separated by commas within parentheses.
            - If fewer than six key elements are visible, use descriptive yet simple words to complete the response.
            - Do not include any other text or explanations.
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
        
        result = result.replace(/\s+/g, '');
        if (!result.startsWith('(')) result = '(' + result;
        if (!result.endsWith(')')) result = result + ')';
        
        return result;
    } catch (error) {
        throw error;
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

// Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startWorkflow") {
        console.log('Starting analysis process...');
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            try {
                await processWorkflow(tabs[0].id);
            } catch (error) {
                chrome.runtime.sendMessage({
                    type: 'error',
                    error: error.message
                });
            }
        });
    }
    else if (message.action === "panelOpened") {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (tabs[0]) {
                await checkPageStateAndExecute(tabs[0].id);
            }
        });
    }
    else if (message.action === "contentUpdated") {
        currentValue = message.value;
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
    else if (message.action === "accountDetailsUpdated") {
        handleAccountDetails(message.details);
    }
});

// Initialize monitoring with automatic execution
setInterval(() => {
    if (!isProcessing) {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (tabs[0]) {
                // First, try to get the current count
                const response = await chrome.tabs.sendMessage(tabs[0].id, {
                    action: "getButtonValue"
                });
                
                if (response) {
                    const count = parseInt(response.value.match(/\((\d+)\)/)?.[1] || '0');
                    const currentTime = Date.now();
                    
                    // If count is high and 10 minutes have passed since last refresh
                    if (count >= 20 && currentTime - lastRefreshTime >= 600000) {
                        console.log('Refreshing page due to high count:', count);
                        await chrome.tabs.reload(tabs[0].id);
                        lastRefreshTime = currentTime;
                        
                        // Wait 5 seconds after refresh before checking state
                        setTimeout(() => checkPageStateAndExecute(tabs[0].id), 5000);
                    } else {
                        // Normal state check
                        await checkPageStateAndExecute(tabs[0].id);
                    }
                }
            }
        });
    }
}, 60000);

// Initial check when extension loads
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0]) {
        await checkPageStateAndExecute(tabs[0].id);
    }
});