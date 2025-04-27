const playwright = require('playwright');
const fs = require('fs');
const path = require('path');
const { handleStart } = require('./src/routes');

// Simple logging function
const log = {
    info: (...args) => console.log('INFO:', ...args),
    error: (...args) => console.error('ERROR:', ...args)
};

// Read input from file
const readInputFromFile = () => {
    try {
        const inputPath = path.join(__dirname, 'input.json');
        const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
        log.info('Read input from input.json:', inputData);
        return inputData;
    } catch (error) {
        log.error('Error reading input.json:', error);
        throw error;
    }
};

const main = async () => {
    // Read input
    const input = readInputFromFile();
    const { startUrl, keywords, startDate, endDate, maxResults, headless = false } = input;

    // Launch browser
    const browser = await playwright.chromium.launch({
        headless,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080',
            '--start-maximized'
        ]
    });

    try {
        // Create a new context
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 }
        });

        // Create a new page
        const page = await context.newPage();

        // Navigate to the URL
        log.info('Navigating to:', startUrl);
        await page.goto(startUrl, { waitUntil: 'networkidle' });

        // Take initial screenshot
        await page.screenshot({ path: 'initial-page.png' });

        // Call the handleStart function with the page and request data
        await handleStart({
            page,
            request: {
                url: startUrl,
                userData: { keywords, startDate, endDate, maxResults }
            }
        });

        log.info('Crawl finished successfully');
    } catch (error) {
        log.error('Crawl failed:', error);
        // Take error screenshot if possible
        if (page) {
            await page.screenshot({ path: 'error.png' });
        }
        throw error;
    } finally {
        // Close browser
        await browser.close();
    }
};

// Run the main function
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});