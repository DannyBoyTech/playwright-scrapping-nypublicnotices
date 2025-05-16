const fs = require('fs');

// Simple logging function
const log = {
    info: (...args) => console.log('INFO:', ...args),
    error: (...args) => console.error('ERROR:', ...args)
};

exports.handleStart = async ({ page, request }) => {
    const { keywords, startDate, endDate, maxResults } = request.userData;
    let totalResults = 0;
    try {
        if (!!maxResults) {
            totalResults = Math.ceil(parseFloat(maxResults / 10));
        }
        log.info(`Search Info: `, { keywords, startDate, endDate });

        // Wait for and fill the search input
        await page.waitForSelector('input[id="control"][aria-label="Keywords"]', { visible: true });
        await page.fill('input[id="control"][aria-label="Keywords"]', keywords);
        log.info('Filled search input with:', keywords);

        // Wait for and fill the start date input (first fluent-text-field)
        await page.waitForSelector('fluent-text-field >> nth=1', { visible: true });
        await page.evaluate((date) => {
            document.querySelectorAll('fluent-text-field')[1].value = date;
        }, startDate);
        log.info('Filled start date with:', startDate);

        // Wait for and fill the end date input (second fluent-text-field)
        await page.waitForSelector('fluent-text-field >> nth=2', { visible: true });
        await page.evaluate((date) => {
            document.querySelectorAll('fluent-text-field')[2].value = date;
        }, endDate);
        log.info('Filled end date with:', endDate);

        // Wait for and click the Search button
        await page.waitForSelector('fluent-button[type="submit"]:has-text("Search")', { visible: true });
        await page.click('fluent-button[type="submit"]:has-text("Search")');
        log.info('Clicked search button');

        await page.waitForTimeout(3000);

        // Wait for results to load
        await page.waitForSelector('div[role="article"]', { timeout: 10000 }).catch(() => {
            log.warning('No articles found on page, might be empty results');
            return;
        });

        // Take screenshot of results
        await page.screenshot({ path: 'search-results.png' });

        let repeat = true;
        let pageCount = 0;
        while (repeat) {
            pageCount++;
            log.info(`Processing page ${pageCount}`);

            const adverts = await page.evaluate(() => {
                const articles = Array.from(document.querySelectorAll('div[role="article"]'));
                
                return articles.map(article => {
                    const newspaper = article.querySelector('strong.text-lg')?.textContent.trim() || 'N/A';
                    const content = article.querySelector('p.text-base')?.textContent.trim() || 'N/A';
                    const publishDates = article.querySelector('p.text-sm strong')?.textContent.trim() || 'N/A';
                    const pdfLink = article.querySelector('a[href*=".pdf"]')?.getAttribute('href') || 'N/A';
                    const county = article.querySelector('h5.text-red-600')?.textContent.trim() || 'N/A';

                    return {
                        NewsPaper: newspaper,
                        ArticleBody: content,
                        PublishDates: publishDates,
                        PdfLink: pdfLink,
                        County: county
                    };
                });
            });

            log.info(`Found ${adverts.length} adverts on page ${pageCount}`);
            
            // Save results to file
            fs.appendFileSync('results.json', JSON.stringify(adverts, null, 2) + '\n');

            if (!!totalResults) {
                totalResults--;
                if (!totalResults) {
                    log.info('Reached maximum results limit');
                    repeat = false;
                }
            }

            if (adverts.length < 10) {
                log.info('Reached last page');
                repeat = false;
            }

            if (repeat) {
                const nextButton = await page.$('fluent-button:has-text("Next")');
                if (nextButton && !(await nextButton.getAttribute('disabled'))) {
                    log.info('Clicking next page');
                    await nextButton.click();
                    await page.waitForTimeout(2000);
                } else {
                    log.info('No next page button found or button is disabled');
                    repeat = false;
                }
            }
        }
    } catch (e) {
        log.error('Error occurred:', e);
        // Take a screenshot on error
        await page.screenshot({ path: 'error-screenshot.png' });
        throw new Error(`Encountered unexpected error: ${e.message}`);
    }
};
