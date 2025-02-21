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
            func: async (indices) => {
                const grid = document.querySelector('[class*="ObjectIdentificationstyle__ObjectIdentificationGrid"]');
                if (grid) {
                    const images = grid.querySelectorAll('img');
                    
                    // Create a function for random delayed clicking
                    const randomDelay = () => {
                        const min = 300;
                        const max = 1000;
                        return new Promise(resolve => 
                            setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min))
                        );
                    };
                    
                    // Click each image with random delay
                    for (let index of indices) {
                        const img = images[index - 1];
                        if (img) {
                            img.click();
                            await randomDelay(); // Wait random time between 300ms and 1000ms
                        }
                    }
                    
                    // Click verify button after all images are clicked
                    setTimeout(() => {
                        const verifyButton = document.querySelector('button[data-t="send-moderation-button"]');
                        if (verifyButton) {
                            verifyButton.click();
                        } else {
                            console.error("Verify button not found");
                        }
                    }, 500);
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

async function updateDescription(tabId, description) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: async (description) => {
                // Helper function for random delays
                const randomDelay = (min, max) => {
                    return new Promise(resolve => 
                        setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min))
                    );
                };

                // Function to simulate human typing
                async function simulateHumanTyping(text) {
                    const textarea = document.querySelector('textarea[aria-label="Caption textarea"]');
                    if (!textarea) {
                        console.error('Textarea not found');
                        return;
                    }

                    let currentText = '';
                    const cleanText = text.replace(/[()]/g, '');

                    // Focus the textarea
                    textarea.focus();

                    // Type each character with random delays
                    for (let char of cleanText) {
                        currentText += char;
                        textarea.value = currentText;

                        // Dispatch input event
                        const inputEvent = new Event('input', { bubbles: true });
                        textarea.dispatchEvent(inputEvent);

                        // Random delay between keystrokes (30-150ms)
                        await randomDelay(30, 150);

                        // Occasional longer pause (like human thinking)
                        if (Math.random() < 0.1) { // 10% chance
                            await randomDelay(400, 800);
                        }
                    }

                    // Dispatch final change event
                    const changeEvent = new Event('change', { bubbles: true });
                    textarea.dispatchEvent(changeEvent);

                    // Blur the textarea after typing
                    await randomDelay(200, 500);
                    textarea.blur();

                    // Click the "Verify" button after typing and a short delay
                    setTimeout(() => {
                        const verifyButton = document.querySelector('button[data-t="captcha-caption-continue"]');
                        if (verifyButton) {
                            verifyButton.click();
                        } else {
                            console.error("Verify button not found");
                        }
                    }, 500);
                }

                // Execute the typing simulation
                await simulateHumanTyping(description);
            },
            args: [description]
        });
    } catch (error) {
        console.error('Description update error:', error);
        throw error;
    }
}

async function processWorkflow(tabId) {
    try {
        // Execute the image selection script
        await executeImageSelectionScript(tabId);

        // Wait for the workflow to proceed
        await new Promise(resolve => setTimeout(resolve, 2000));

        let finalResult = {};
        let maxIterations = 10;
        let iteration = 0;

        while (iteration < maxIterations) {
            // Check for the presence of grid images
            const gridImage = await captureScreenshot(tabId, 'div[class*="ObjectIdentification"]');
            if (gridImage) {
                const gridAnalysis = await analyzeGridImage(gridImage);
                finalResult.gridResult = gridAnalysis.formatted;
                await clickGridImages(tabId, gridAnalysis.indices);
                await new Promise(resolve => setTimeout(resolve, 2000));
                iteration++;
                continue;
            }

            // Check for the presence of description image
            const descImage = await captureScreenshot(tabId, 'div[class*="Captionstyle__StyledImage"] img');
            if (descImage) {
                const descAnalysis = await analyzeDescriptionImage(descImage);
                finalResult.descriptionResult = descAnalysis;
                await updateDescription(tabId, descAnalysis);
                await new Promise(resolve => setTimeout(resolve, 2000));
                iteration++;
                continue;
            }

            // Check for the presence of the final submit button
            const finalSubmitButton = await checkElementExists(tabId, 'button[data-t="send-moderation-button"]');
            if (finalSubmitButton) {
                await clickFinalSubmitButton(tabId);
                break;
            }

            // Wait before the next iteration
            await new Promise(resolve => setTimeout(resolve, 2000));
            iteration++;
        }

        // Send combined results
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
                const containers = document.querySelectorAll('.container-inline-block');
                const startIndex = 1, numberOfSelections = 2;
                const clickCheckboxByText = (text, delay = 0) => {
                    setTimeout(() => {
                        const checkbox = Array.from(document.querySelectorAll('label'))
                            .find(label => label.textContent.trim() === text)?.querySelector('input[type="checkbox"]');
                        checkbox?.click() && console.log(`${text} checkbox clicked!`);
                    }, delay);
                };

                // Select the images
                [...containers].slice(startIndex, startIndex + numberOfSelections).forEach(container => {
                    container.querySelector('img.upload-tile__thumbnail')?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
                    console.log(`Selected image in container at index ${[...containers].indexOf(container)}`);
                });

                // Submit and proceed with checkboxes and continue button
                setTimeout(() => {
                    const submitButton = document.querySelector('button[data-t="submit-moderation-button"]');
                    if (submitButton) {
                        submitButton.click();
                        console.log('Submit button clicked.');

                        setTimeout(() => {
                            // Click checkboxes with specific delays
                            clickCheckboxByText('I reviewed the submission guidelines and confirm in particular that:');
                            clickCheckboxByText('I understand that my account can be suspended if I breach the guidelines.', 500);

                            // Click the continue button after 1000ms
                            setTimeout(() => {
                                const continueButton = document.querySelector('button[data-t="continue-moderation-button"]');
                                continueButton ? continueButton.click() && console.log("Continue button clicked!") : console.log("Continue button not found.");
                            }, 1000);
                        }, 1000); // 1 second after submit
                    } else {
                        console.error('Submit button not found.');
                    }
                }, 1000); // 1 second delay before submit
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
                    console.log('Final submit button clicked.');
                } else {
                    console.error('Final submit button not found.');
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

            **Key Instructions**:
            - Analyze each image thoroughly, taking extra time if necessary.
            - If there is even a slight indication of a cat in an image, include that image number.
            - Triple-check each image and prioritize accuracy over speed.
            - Do not skip any numbers or make assumptions without direct evidence.

            **Response Format**:
            - If all images have cats: (1,2,3,4,5,6)
            - If only images 1,3,5 have cats: (1,3,5)
            - If only image 4 has a cat: (4)

            **Important**:
            - Failure to follow these steps may lead to incorrect results.
            - Triple-checking and cross-verification are mandatory for every image.
            - No image should be skipped, and no assumptions should be made.

            Begin the task systematically now.
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
            
            **Important Instructions**:
            - Your response MUST include AT LEAST six (6) distinct words.
            - Format your response exactly like this example: (doctor,smiling,hand,headset,green,chair)
            - Use only simple, single words separated by commas within parentheses.
            - If fewer than six key elements are visible, use descriptive yet simple words to complete the response (e.g., colors, objects, or actions in the image).
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
});