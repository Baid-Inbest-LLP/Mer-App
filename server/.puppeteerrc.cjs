/**
 * Puppeteer configuration — skip bundled Chromium download.
 *
 * On Render (and other serverless/CI environments) we use @sparticuz/chromium
 * via puppeteer-core, so the full puppeteer Chromium (~200 MB) is never needed.
 * Skipping it avoids build timeouts and keeps the deploy bundle small.
 *
 * For local development, install Chrome/Chromium separately and set the
 * PUPPETEER_EXECUTABLE_PATH environment variable if it is not on the default path.
 */
module.exports = {
  skipDownload: true,
};
