const path = require('path');

const logger = require('../logger/logger');
const {
    generateDateTuples,
    getLastStatementDate,
    getLatestTuples,
    joinSiteIDAndAccount,
    parseLuxonsFromTuples,
    setLastStatementDate,
    transferStatements,
    waitForChecksum,
    waitForLoad,
} = require('./site-utils');
const { getConfig } = require('../config-utils/config-utils');
const { waitForTimeout } = require('../utils/utils');

const config = getConfig();
const runningDev = process.env.NODE_ENV === 'dev';

/**
 * A function to parse the DOM for elements containing statement dates.
 * This function will search for elements and compare them against expected
 * HTML attributes and regular expressions. For all elements that pass,
 * the dates with which each is associated is returned as an array of rawTexts.
 *
 * Pass an object containing:
 * - `page` - A puppeteer browser page
 * - `site` - An object containing a website's data and configs
 * @param {Object} args
 * @returns {Promise<Array<string>>} A promise that resolves to an array of raw date texts
 */
const findDateTextStrings = async ({ page, site }) => {
    const rawTextList = await page.$$eval(
        site.statements.dateElements,
        (dateElements, docs) => {
            let rawTextList = [];
            const regex = new RegExp(docs.regex);
            dateElements.forEach((dateElement) => {
                // TODO - Refactor such that candidateAttributes can be any length
                const candidateElement =
                    docs.candidateAttributes.length === 1
                        ? dateElement[docs.candidateAttributes[0]]
                        : dateElement[docs.candidateAttributes[0]][
                              docs.candidateAttributes[1]
                          ];

                if (regex.test(candidateElement)) {
                    rawTextList.push(dateElement[docs.dateTextAttribute]);
                }
            });

            return rawTextList;
        },
        site.statements,
    );

    logger.info(`${site.id}: rawTextList: `, rawTextList);
    return rawTextList;
};

/**
 * A function to download finance statements given a list of elements to find.
 * Using the Promise-Reducer pattern, this function finds elements by their rawText and clicks on them.
 * If a site has extra download steps, they are taken care of with additional delays as needed.
 *
 * Pass an object containing:
 * - `page` - A puppeteer browser page
 * - `site` - An object containing a website's data and configs
 * - `dateTuples` - An array of tuples containing elements to find
 * @param {Object} args
 * @param {Object} args.page
 * @param {Object} args.site
 * @param {Array<Object>} args.dateTuples
 * @returns {Promise<boolean>} A promise that resolves to boolean: `true` if successful, `false` otherwise
 */
const downloadStatements = async ({ page, site, dateTuples }) => {
    logger.info(`${site.id}: Downloading [${dateTuples.length}] statement(s)`);

    return dateTuples.reduce(async (promise, tuple) => {
        const previousTupleSuccessful = await promise;
        if (!previousTupleSuccessful) Promise.resolve(false);

        await waitForTimeout({ timeout: site.statements.stepDelay });
        return new Promise((resolve) => {
            logger.info(`${site.id}: rawText: `, tuple.rawText);
            page.$x(
                `//${site.statements.xpath}[contains(., '${tuple.rawText}')]`,
            )
                .then(([element]) => {
                    element
                        .click()
                        .then(() => {
                            if (!site.statements.download) {
                                resolve(true);
                                return true;
                            }

                            site.statements.download
                                .reduce(async (promise, downloadStep) => {
                                    const previousStepSuccessful = await promise;
                                    if (!previousStepSuccessful) {
                                        Promise.resolve(false);
                                    }

                                    return new Promise((resolve) => {
                                        waitForTimeout({
                                            timeout: site.statements.stepDelay,
                                        }).then(() => {
                                            logger.info(
                                                `${site.id}: extra downloadStep: `,
                                                downloadStep,
                                            );
                                            page.waitForSelector(downloadStep)
                                                .then(() => {
                                                    page.click(downloadStep)
                                                        .then(() => {
                                                            resolve(true);
                                                        })
                                                        .catch((error) => {
                                                            logger.error(
                                                                `${site.id}: Error clicking downloadStep ${downloadStep}: `,
                                                                error.stack,
                                                            );
                                                            resolve(false);
                                                        });
                                                })
                                                .catch((error) => {
                                                    logger.error(
                                                        `${site.id}: Error waiting for downloadStep ${downloadStep}: `,
                                                        error.stack,
                                                    );
                                                    resolve(false);
                                                });
                                        });
                                    });
                                }, Promise.resolve(true))
                                .then((promise) => {
                                    resolve(promise);
                                })
                                .catch((error) => {
                                    logger.error(
                                        `${site.id}: Error on downloadSteps: `,
                                        error.stack,
                                    );
                                });
                        })
                        .catch((error) => {
                            logger.error(
                                `${site.id}: Error clicking ${tuple.rawText}: `,
                                error.stack,
                            );
                            resolve(false);
                        });
                })
                .catch((error) => {
                    logger.error(
                        `${site.id}: Error downloading statements: `,
                        error.stack,
                    );
                    resolve(false);
                });
        });
    }, Promise.resolve(true));
};

/**
 * A function to spin while waiting for user to manually handle both
 * downloading statements and updating last date on file. Transferring
 * statements will still occur automatically.
 *
 * Pass an object containing:
 * - `page` - A puppeteer browser page
 * - `site` - An object containing a website's data and configs
 * - `manualURL` - A string containing the URL to which to navigate to end the spinnning
 * - `downloadPath` - A string path of the directory where statements are downloaded
 * @param {Object} args
 */
const manualStatements = async ({ page, site, manualURL, downloadPath }) => {
    // Spin while waiting for user to handle statements manually
    while (!page.url().includes(manualURL)) {
        logger.info(
            `${site.id}: Download and update last date manually (transfer is automatic) - spinning until URL includes '${manualURL}'`,
        );
        await waitForTimeout({ timeout: 30000 });
    }

    if (runningDev) return true;

    // Transfer statements
    const statementsTransferred = transferStatements({
        site,
        downloadPath,
    });
    logger.info(`${site.id}: statementsTransferred: `, statementsTransferred);

    return statementsTransferred ? true : false;
};

/**
 * A function to handle finance website statements.
 *
 * Pass an object containing:
 * - `page` - A puppeteer browser page
 * - `site` - An object containing a website's data and configs
 * @param {Object} args
 * @returns {Promise<boolean>} A promise that resolves to a boolean: `true` if statements were handled, `false` otherwise
 */
const handleFinanceStatements = async ({ page, site }) => {
    try {
        // Get to statements page
        if (site.statements.element) {
            logger.info(
                `${site.id}: Clicking statements element: `,
                site.statements.element,
            );

            await page.click(site.statements.element);
        } else if (site.statements.evalElement) {
            logger.info(
                `${site.id}: Evaluating statements DOM element: `,
                site.statements.evalElement,
            );

            await page.$eval(
                site.statements.evalElement,
                (statementsButton) => {
                    statementsButton.click();
                },
            );
        } else {
            logger.info(
                `${site.id}: Navigating to statements url: `,
                site.statements.link,
            );

            await page.goto(site.statements.link);
        }
        await waitForLoad({
            page,
            site,
            requestCount: 0,
            timeout: 8000,
        });

        // Change download location per page, per account
        const downloadFolder = joinSiteIDAndAccount(site, ' ');
        const downloadPath = path.join(
            config.externalPaths.downloads,
            downloadFolder,
        );
        logger.info(`${site.id}: downloadPath: `, downloadPath);
        await page._client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath,
        });

        /* Manual handling - catch sites that are not yet automated */
        const manualURL = site.statements.manual;
        if (manualURL) {
            return await manualStatements({
                page,
                site,
                manualURL,
                downloadPath,
            });
        }

        /* Automated statements handling */
        const rawTextList = await findDateTextStrings({ page, site });
        const dateTuples = generateDateTuples({ rawTextList, site });
        const latestLuxon = getLastStatementDate(site);
        const latestTuples = getLatestTuples({ site, dateTuples, latestLuxon });
        const statementsDownloaded = await downloadStatements({
            page,
            site,
            dateTuples: latestTuples,
        });
        logger.info(`${site.id}: statementsDownloaded: `, statementsDownloaded);
        if (!statementsDownloaded) return false;
        await waitForChecksum({ site, dateTuples: latestTuples, downloadPath });

        /* Do not change last statement date or transfer when developing */
        if (runningDev) return true;

        // Transfer statements
        const statementsTransferred = transferStatements({
            site,
            downloadPath,
        });
        logger.info(
            `${site.id}: statementsTransferred: `,
            statementsTransferred,
        );
        if (!statementsTransferred) return false;

        // Update last statement date
        const luxons = parseLuxonsFromTuples(latestTuples);
        luxons.push(latestLuxon);
        const lastDateSetSuccessfully = setLastStatementDate({ site, luxons });
        logger.info(
            `${site.id}: lastDateSetSuccessfully: `,
            lastDateSetSuccessfully,
        );
        if (!lastDateSetSuccessfully) return false;

        return true;
    } catch (error) {
        logger.error(`${site.id}: Error handling statements: `, error.stack);
        return false;
    }
};

module.exports = { handleFinanceStatements };
