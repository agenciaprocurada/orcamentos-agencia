import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') console.error('Browser Error:', msg.text());
    });

    page.on('pageerror', error => {
        console.error('Page Error:', error.message);
    });

    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle0' });
    await browser.close();
})();
