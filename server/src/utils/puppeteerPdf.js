import fs from 'fs';
import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';

let browserPromise = null;
const usePackagedChromium = Boolean(process.env.VERCEL || process.env.RENDER);

/** Resolve the Chrome/Chromium executable path for local development. */
const getLocalChromePath = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* next */
    }
  }
  return undefined;
};

const launchPackagedBrowser = async () => {
  // Disable WebGL/swiftshader extraction — saves memory on Render.
  chromium.setGraphicsMode = false;

  const executablePath = await chromium.executablePath();
  if (!executablePath) {
    throw new Error('Packaged Chromium executable path could not be resolved');
  }

  return puppeteerCore.launch({
    args: [...chromium.args, '--disable-dev-shm-usage'],
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
};

const getLocalBrowser = () => {
  if (!browserPromise) {
    browserPromise = (async () => {
      const executablePath = getLocalChromePath();
      if (!executablePath) {
        throw new Error(
          'Chrome/Chromium not found locally. Set PUPPETEER_EXECUTABLE_PATH in server/.env',
        );
      }
      return puppeteerCore.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    })();
  }
  return browserPromise;
};

// Pre-warm only for local dev (long-running Chrome).
if (!usePackagedChromium) {
  getLocalBrowser().catch((err) => {
    console.error('Failed to pre-warm Puppeteer:', err);
    browserPromise = null;
  });
}

const shutdown = async () => {
  try {
    if (!browserPromise) return;
    const browser = await browserPromise;
    if (browser && browser.close) await browser.close();
  } catch {
    /* ignore */
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/** Render a full HTML document (landscape Legal) to a PDF buffer. */
export const renderHtmlToPdfBuffer = async (html) => {
  // On Render: launch a fresh browser per request (avoids stale/OOM singleton).
  const browser = usePackagedChromium ? await launchPackagedBrowser() : await getLocalBrowser();

  let page;
  try {
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page
      .evaluate(() =>
        Promise.all(
          [...document.images].map(
            (img) =>
              new Promise((resolve) => {
                if (img.complete) {
                  resolve();
                  return;
                }
                img.addEventListener('load', () => resolve());
                img.addEventListener('error', () => resolve());
              }),
          ),
        ),
      )
      .catch(() => {});

    const buffer = await page.pdf({
      format: 'Legal',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    });

    return buffer;
  } finally {
    if (page) await page.close().catch(() => {});
    if (usePackagedChromium && browser) await browser.close().catch(() => {});
  }
};
