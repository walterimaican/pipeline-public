const open = require('open');

const logger = require('../services/logger/logger');
const {
    getConfig,
    getSitesConfig,
} = require('../services/config-utils/config-utils');
const {
    handleMultipleFinanceSites,
} = require('../services/site-handling/site-handling');
const { getDataFromVolume } = require('../services/veracrypt/veracrypt');
const { waitForInput } = require('../services/utils/utils');

const config = getConfig();
const sitesConfig = getSitesConfig();
const runningDev = process.env.NODE_ENV === 'dev';

/**
 * A subroutine that will execute tasks related to documents
 * @param {string} separator Pass a commonly used logs separator
 */
const documentsPipeline = async (separator) => {
    logger.info('Running documents pipeline.');
    logger.info(separator);

    // Get credentials from volume - do NOT log!
    const { jsonData: credentials } = getDataFromVolume('credentials');

    // Launch finance sites, login, handle documents
    await handleMultipleFinanceSites({
        sitesList: runningDev ? sitesConfig.dev : sitesConfig.finances,
        credentialsList: credentials.finances,
        puppeteerPreferences: config.puppeteer,
    });
    logger.info(separator);

    // Manually handle other sources of documents
    logger.info('Please manually handle the following:');

    logger.info('=== Downloads ===');
    logger.warn('Opening folder...');
    await open(config.externalPaths.downloads);
    await waitForInput();

    logger.info('=== Desktop ===');
    logger.warn('Opening folder...');
    await open(config.externalPaths.desktop);
    await waitForInput();

    logger.info('=== Laptop ===');
    logger.warn('-> Go to laptop desktop and downloads');
    await waitForInput();

    logger.info('=== Chrome Bookmarks ===');
    logger.warn('Launching Chrome...');
    await open('https://www.google.com/');
    await waitForInput();

    logger.info('=== Emails ===');
    logger.warn('-> Handle via iOS app');
    await waitForInput();
};

module.exports = documentsPipeline;
