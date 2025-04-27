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
        await page.waitForSelector('input[type="search"][aria-label="Search..."]', { visible: true });
        await page.fill('input[type="search"][aria-label="Search..."]', keywords);
        log.info('Filled search input with:', keywords);

        // Wait for and fill the start date input (first fluent-text-field)
        await page.waitForSelector('fluent-text-field >> nth=0', { visible: true });
        await page.evaluate((date) => {
            document.querySelectorAll('fluent-text-field')[0].value = date;
        }, startDate);
        log.info('Filled start date with:', startDate);

        // Wait for and fill the end date input (second fluent-text-field)
        await page.waitForSelector('fluent-text-field >> nth=1', { visible: true });
        await page.evaluate((date) => {
            document.querySelectorAll('fluent-text-field')[1].value = date;
        }, endDate);
        log.info('Filled end date with:', endDate);

        // Wait for and click the Search button
        await page.waitForSelector('fluent-button[type="button"]:has-text("Search")', { visible: true });
        await page.click('fluent-button[type="button"]:has-text("Search")');
        log.info('Clicked search button');

        await page.waitForTimeout(3000);

        // Wait for results to load
        await page.waitForSelector('.fluent-grid', { timeout: 10000 }).catch(() => {
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
                const articles = Array.from(document.querySelectorAll('.fluent-grid > div'));
                // Skip first 3 elements
                const filteredArticles = articles.slice(3);
                
                return filteredArticles.map(article => {
                    const newspaper = article.querySelector('.fluent-messagebar-message .title')?.textContent.trim() || 'N/A';
                    const content = article.querySelector('div[style*="min-width: 175px"]')?.textContent.trim() || 'N/A';
                    const publishDates = article.querySelectorAll('.fluent-messagebar.intent-info')[1]?.textContent.replace('Publish Date(s)', '').trim().replace('\n\n           ','') || 'N/A';
                    const pdfLink = article.querySelector('fluent-anchor')?.getAttribute('href') || 'N/A';

                    return {
                        NewsPaper: newspaper,
                        ArticleBody: content,
                        PublishDates: publishDates,
                        PdfLink: pdfLink
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

            if (repeat && !!(await page.$('a[aria-label="Next"]'))) {
                log.info('Clicking next page');
                await page.click('text=»');
                await page.waitForTimeout(2000);
            } else if (repeat) {
                log.info('No next page button found');
                repeat = false;
            }
        }
    } catch (e) {
        log.error('Error occurred:', e);
        // Take a screenshot on error
        await page.screenshot({ path: 'error-screenshot.png' });
        throw new Error(`Encountered unexpected error: ${e.message}`);
    }
};
