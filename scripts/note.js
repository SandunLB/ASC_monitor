agreement modal 

const clickCheckboxByText = (text, delay = 0) => {
    setTimeout(() => {
      const label = Array.from(document.querySelectorAll('label'))
        .find(label => label.textContent.trim() === text);
      const checkbox = label?.querySelector('input[type="checkbox"]');
      
      if (checkbox) {
        checkbox.click();
        console.log(`${text} checkbox clicked!`);
      } else {
        console.log(`${text} checkbox not found.`);
      }
    }, delay);
  };
  
  // Click the first checkbox
  clickCheckboxByText('I reviewed the submission guidelines and confirm in particular that:');
  
  // Click the second checkbox with 500ms delay
  clickCheckboxByText('I understand that my account can be suspended if I breach the guidelines.', 500);
  
  // After the checkboxes, click the "Continue" button
  setTimeout(() => {
    const continueButton = document.querySelector('button[data-t="continue-moderation-button"]');
    
    if (continueButton) {
      continueButton.click();
      console.log("Continue button clicked!");
    } else {
      console.log("Continue button not found.");
    }
  }, 1000); // Waiting 1000ms to ensure checkboxes are clicked first


verification modal

// Find the grid element using the partial class name
const grid = document.querySelector('[class*="ObjectIdentificationstyle__ObjectIdentificationGrid"]');

// Ensure the grid exists, then find its child images
if (grid) {
  const images = grid.querySelectorAll('img');
  
  // Click on images at index 4 and 5
  if (images[4]) images[4].click();
  if (images[5]) images[5].click();
} else {
  console.error("Grid element not found.");
}


take screenshot 

// First, let's check what element we actually want to capture
const grid = document.querySelector('div[class*="ObjectIdentification"]');
console.log('Found element:', grid);

// If we find it, let's take the screenshot
if (grid) {
    const script = document.createElement('script');
    script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
    script.onload = async () => {
        try {
            const canvas = await html2canvas(grid, {
                scale: 2,
                useCORS: true,
                logging: true,
                backgroundColor: null
            });
            
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'element-screenshot.png';
                link.click();
                URL.revokeObjectURL(url);
            }, 'image/png');
        } catch (error) {
            console.error('Error capturing screenshot:', error);
        }
    };
    document.body.appendChild(script);
} else {
    console.log('Available elements with similar classes:', document.querySelectorAll('div[class*="ObjectIdentification"]'));
}

Select images in new pahe 

const containers = document.querySelectorAll('.container-inline-block');
const startIndex = 1, numberOfSelections = 5;

[...containers].slice(startIndex, startIndex + numberOfSelections).forEach(container => {
    const img = container.querySelector('img.upload-tile__thumbnail');
    img?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    console.log(`Selected image in container at index ${[...containers].indexOf(container)}`);
});
