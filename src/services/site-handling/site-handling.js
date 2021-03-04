const { Cluster } = require('puppeteer-cluster');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserPreferencesPlugin = require('puppeteer-extra-plugin-user-preferences');

const logger = require('../logger/logger');
const { execWrapper, generatePushCommand } = require('../utils/utils');
const { loginToSite } = require('./login-handling');
const { joinSiteIDAndAccount, splitMultiAccountSite } = require('./site-utils');
const { handleFinanceStatements } = require('./statements-handling');

const runningDev = process.env.NODE_ENV === 'dev';
const runNumber = process.env.RUN_NUMBER;
puppeteerExtra.addExtra();

/**
 * A function to handle an individual finance site's login and statements.
 *
 * Pass an object containing:
 * - `page` - A puppeteer browser page
 * - `site` - An object containing a website's data and configs
 * - `credentials` - An object containing the credentials for `site`
 * @param {Object} args
 */
const handleFinanceSite = async ({ page, site, credentials }) => {
    /* User text input goes to URL instead of focused element due to frame priorities;
    This brings the page to the front for user interactivity. */
    await page.bringToFront();

    const successStatus = { site, successful: true };
    const failureStatus = { site, successful: false };

    try {
        const loginSuccessful = await loginToSite({
            page,
            site,
            credentials,
        });
        logger.info(`${site.id}: loginSuccessful: `, loginSuccessful);
        if (!loginSuccessful) return failureStatus;

        const uniqueAccountSites = splitMultiAccountSite(site);
        const siteStatementsHandled = await uniqueAccountSites.reduce(
            async (promise, site) => {
                const previousAccountSuccessful = await promise;
                if (!previousAccountSuccessful) Promise.resolve(false);

                const siteAccount = joinSiteIDAndAccount(site, ' ');
                logger.info(`${siteAccount}: Now handling statements`);

                return new Promise((resolve) => {
                    handleFinanceStatements({
                        page,
                        site,
                    })
                        .then((statementsHandled) => {
                            logger.info(
                                `${siteAccount}: statementsHandled: `,
                                statementsHandled,
                            );
                            resolve(statementsHandled);
                        })
                        .catch((error) => {
                            logger.error(
                                `${siteAccount}: Error handling statements: `,
                                error.stack,
                            );
                            resolve(false);
                        });
                });
            },
            Promise.resolve(true),
        );

        if (!siteStatementsHandled) return failureStatus;
        return successStatus;
    } catch (error) {
        logger.error(`${site.id}: Error during handling: `, error.stack);
        return failureStatus;
    }
};

/**
 * An intermediary wrapper function for enqueuing tasks for puppeteer clusters.
 * Returns a call to `handleFinanceSite()`. For `cluster.execute()`, pass:
 * - `data` - A wrapper object around `site` and `credentials`
 * @param {Object} args
 */
const handleFinanceSiteClusterTask = async ({ page, data }) => {
    const { site, credentials } = data;
    return handleFinanceSite({ page, site, credentials });
};

/**
 * Handle multiple finance sites in parallel.
 *
 * Pass an object containing:
 * - `sitesList` - An array of websites to visit and their configurations
 * - `credentialsList` - An array of credentials corresponding to `sitesList`
 * - `puppeteerPreferences` - A config object which itself contains the following:
 * -- `userPrefs` - A config object for puppeteer-extra-plugin-user-preferences
 * -- `maxConcurrency` - A number for maximum concurrent puppeteer browsers
 * -- `clustersTimeout` - A number in milliseconds to timeout (for all browsers)
 * -- `puppeteerOptions` - A config object for vanilla puppeteer arguments
 * @param {Object} Config
 * @param {Array} Config.sitesList
 * @param {Array} Config.credentialsList
 * @param {Object} Config.puppeteerPreferences
 */
const handleMultipleFinanceSites = async ({
    sitesList,
    credentialsList,
    puppeteerPreferences,
}) => {
    try {
        const {
            userPrefs,
            maxConcurrency,
            clustersTimeout,
            puppeteerOptions,
        } = puppeteerPreferences;

        puppeteerExtra.use(UserPreferencesPlugin({ userPrefs }));
        puppeteerExtra.use(StealthPlugin());
        const cluster = await Cluster.launch({
            maxConcurrency,
            puppeteer: puppeteerExtra,
            timeout: clustersTimeout,
            puppeteerOptions,
        });
        await cluster.task(handleFinanceSiteClusterTask);

        Promise.allSettled(
            sitesList.map(async (site) => {
                /* Do NOT log credentials! */
                const credentials = credentialsList.find(
                    (credentials) => credentials.id === site.id,
                );

                const results = await cluster.execute({
                    site,
                    credentials,
                });
                logger.info(`${site.id}: successful: `, results.successful);
                return results;
            }),
        )
            .then((parallelSitesResults) => {
                let successfulSites = 0;
                let failedSites = [];

                parallelSitesResults.forEach((result) => {
                    result.value.successful
                        ? successfulSites++
                        : failedSites.push(result.value.site.id);
                });

                logger.info(
                    `Successfully handled sites: ${successfulSites} / ${sitesList.length}`,
                );

                failedSites.length
                    ? logger.warn('The following sites failed: ', failedSites)
                    : logger.info('All sites handled successfully!');
            })
            .catch((error) => {
                logger.error('Error handling multiple sites: ', error.stack);
                logger.warn('Did puppeteer clusters timeout?');
            });

        await cluster.idle();
        await cluster.close();

        /* Do not push data changes if in dev */
        if (runningDev) return;

        const pushDataCommand = generatePushCommand(runNumber, 'data');
        const scriptStatus = await execWrapper(pushDataCommand, true);
        if (!scriptStatus) throw new Error('Failed to push data');
    } catch (error) {
        logger.error('Error handling multiple sites: ', error.stack);
    }
};

module.exports = {
    handleMultipleFinanceSites,
};
