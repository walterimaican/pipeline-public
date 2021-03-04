const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

const logger = require('../logger/logger');
const { getConfig } = require('../config-utils/config-utils');
const { waitForTimeout } = require('../utils/utils');

const config = getConfig();

/**
 * A function to create tuples of raw DOM statement dates and parsed Luxon DateTime objects.
 *
 * Pass an object containing:
 * - `rawTextList` - An array of raw date texts
 * - `site` - An object containing a website's data and configs
 * @param {Object} args
 * @param {Array<string>} args.rawTextList
 * @param {Object} args.site
 * @returns {Array<Object>} An array of tuples containing raw text strings and parsed Luxons
 */
const generateDateTuples = ({ rawTextList, site }) => {
    const dateTuples = rawTextList.map((rawText) => {
        if (site.statements.luxonRegex) {
            const luxonRegex = new RegExp(site.statements.luxonRegex);
            rawText = luxonRegex.exec(rawText)[0];
        }
        const parsedLuxon = DateTime.fromFormat(
            rawText,
            site.statements.dateFormat,
        );
        return { rawText, parsedLuxon };
    });

    logger.info(`${site.id}: dateTuples: `, dateTuples);
    return dateTuples;
};

/**
 * A function to get the latest statement date on file as a Luxon DateTime object.
 * @param {Object} site An object containing a website's data and configs
 * @returns {DateTime} Returns a Luxon DateTime of the latest date
 */
const getLastStatementDate = (site) => {
    const financialsName = joinSiteIDAndAccount(site, '');
    const financialsPath = path.join(
        config.pipelinePath,
        config.relativePaths.data,
        `${financialsName}.json`,
    );
    logger.info(`${site.id}: Retrieving data from: `, financialsPath);

    const financials = require(financialsPath);
    logger.info(`${site.id}: Getting financials:`, financials);

    const latestLuxon = DateTime.fromISO(financials.latestDate);
    logger.info(`${site.id}: latestLuxon: `, latestLuxon);
    return latestLuxon;
};

/**
 * A function to get the latest statement date tuples by comparing to the latest on file.
 *
 * Pass an object containing:
 * - `site` - An object containing a website's data and configs
 * - `dateTuples` - An array of tuples containing raw text strings and parsed Luxons
 * - `latestLuxon` - A Luxon DateTime of the latest date on file
 * @param {Object} args
 * @param {Object} args.site
 * @param {Array<Object>} args.dateTuples
 * @param {DateTime} args.latestLuxon
 * @returns {Array<Object>} An array of tuples that are newer than the last date on file
 */
const getLatestTuples = ({ site, dateTuples, latestLuxon }) => {
    if (isNaN(latestLuxon.valueOf())) {
        logger.warn(`${site.id}: Last date on file is empty, need all docs`);
        logger.info(`${site.id}: tuples: `, dateTuples);
        return dateTuples;
    }

    const latestTuples = dateTuples.filter(
        (tuple) => tuple.parsedLuxon.valueOf() > latestLuxon.valueOf(),
    );
    logger.info(`${site.id}: tuples: `, latestTuples);
    return latestTuples;
};

/**
 * A function to join together a site's id and account, if account name exists
 * @param {Object} site An object containing a website's data and configs
 * @param {string} separator A string indicating how to separate tokens
 */
const joinSiteIDAndAccount = (site, separator) => {
    return [site.id, site.statements.account].join(separator).trim();
};

/**
 * A function to parse out Luxon DateTimes given an array of tuples
 * @param {Array<Object>} tuples An array of tuples
 * @returns {Array<DateTime>} An array of Luxon DateTimes
 */
const parseLuxonsFromTuples = (tuples) => {
    const tuplesCloned = _.cloneDeep(tuples);
    return tuplesCloned.map((tuple) => tuple.parsedLuxon);
};

/**
 * A function to update the latest statement date for a given site.
 *
 * Pass an object containing:
 * - `site` - An object containing a website's data and configs
 * - `luxons` - An array of Luxon DateTimes
 * @param {Object} args
 * @param {Object} args.site
 * @param {Array<DateTime>} args.luxons
 * @returns {boolean} `true` if successful, `false` otherwise
 */
const setLastStatementDate = ({ site, luxons }) => {
    try {
        const latestLuxon = DateTime.max(...luxons);
        const lastDate = latestLuxon.toISODate();

        const financialsName = joinSiteIDAndAccount(site, '');
        const financialsPath = path.join(
            config.pipelinePath,
            config.relativePaths.data,
            `${financialsName}.json`,
        );
        const financials = require(financialsPath);

        let updatedFinancials = _.cloneDeep(financials);
        updatedFinancials.latestDate = lastDate;
        logger.info(`${site.id}: Updated financials:`, updatedFinancials);

        logger.info(`${site.id}: Writing changes to path: `, financialsPath);
        fs.writeFileSync(financialsPath, JSON.stringify(updatedFinancials));
        return true;
    } catch (error) {
        logger.error(
            `${site.id}: Error overwriting last statement date: `,
            error.stack,
        );
        return false;
    }
};

/**
 * A function that will return an array of site JSONs, where each site is the
 * same except for a unique `statements` value if given a multi-account site.
 * If given a single-account site, returns that site encapsulated in an array.
 * @param {Object} site An object containing a website's data and configs
 * @returns {Array<Object>} An array of unique account sites
 */
const splitMultiAccountSite = (site) => {
    if (!(site.statements instanceof Array)) {
        logger.info(`${site.id}: Not a multi-account site`);
        return [site];
    }

    logger.info(`${site.id}: Is a multi-account site`);
    const { statements, ...everythingElse } = site;
    return statements.map((statementObject) => {
        return { ...everythingElse, statements: statementObject };
    });
};

/**
 * A function to transfer downloaded statements to the right location.
 *
 * Pass an object containing:
 * - `site` - An object containing a website's data and configs
 * - `downloadPath` - Path for the folder containing this site's statements
 * @param {Object} args
 * @param {Object} args.site
 * @param {string} args.downloadPath
 * @returns {boolean} `true` if successful, `false` otherwise
 */
const transferStatements = ({ site, downloadPath }) => {
    try {
        logger.info(`${site.id}: Transferring statements`);

        const financialsName = joinSiteIDAndAccount(site, '');
        const financialsPath = path.join(
            config.pipelinePath,
            config.relativePaths.data,
            `${financialsName}.json`,
        );
        const financials = require(financialsPath);

        const subFolder = financials.type;
        const destinationPath = path.join(
            config.veracryptDrive + ':',
            config.veracryptPaths.financialsDirectory,
            subFolder,
            joinSiteIDAndAccount(site, ' '),
        );
        logger.info(`${site.id}: Source Folder: `, downloadPath);
        logger.info(`${site.id}: Destination Folder: `, destinationPath);

        // Creates destination subdirectories if they don't exist and move files
        // Deletes source files while moving and source directory afterwards
        fs.mkdirSync(destinationPath, { recursive: true });
        fs.readdirSync(downloadPath).map((file) =>
            fs.renameSync(
                path.join(downloadPath, file),
                path.join(destinationPath, file),
            ),
        );
        fs.rmdirSync(downloadPath);

        return true;
    } catch (error) {
        logger.error(
            `${site.id}: Error transferring statements: `,
            error.stack,
        );
        return false;
    }
};

/**
 * A function to check if the correct number of statements have been downloaded.
 * If not, poll for manual correction.
 *
 * Pass an object containing:
 * - `site` - An object containing a website's data and configs
 * - `dateTuples` - An array of tuples containing raw text strings and parsed Luxons
 * - `downloadPath` - Path for the folder containing this site's statements
 * @param {Object} args
 * @param {Object} args.site
 * @param {Array<Object>} args.dateTuples
 * @param {string} downloadPath
 */
const waitForChecksum = async ({ site, dateTuples, downloadPath }) => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const expectedTotal = dateTuples.length;
        const actualTotal = fs.readdirSync(downloadPath).length;

        if (expectedTotal === actualTotal) {
            logger.info(
                `${site.id}: All [${expectedTotal}] statement(s) downloaded`,
            );
            return;
        }

        logger.warn(
            `${site.id}: Expected [${expectedTotal}] statement(s) but downloaded [${actualTotal}] statement(s) instead - waiting for user to address`,
        );

        // Subroutine to scan for duplicates in rawText of dateTuples and suggest to user
        const stringifiedTuples = dateTuples.map((tuple) =>
            JSON.stringify(tuple),
        );
        const dateTuplesSet = new Set(stringifiedTuples);
        let duplicates = [];
        stringifiedTuples.forEach((tuple) => {
            dateTuplesSet.has(tuple)
                ? dateTuplesSet.delete(tuple)
                : duplicates.push(tuple);
        });
        const uniqueDuplicates = Array.from(new Set(duplicates)).map((tuple) =>
            JSON.parse(tuple),
        );
        logger.warn(`${site.id}: Potential duplicate(s): `, uniqueDuplicates);

        // Poll every 30 seconds
        await waitForTimeout({ timeout: 30000 });
    }
};

/**
 * A function to delay when on a website by racing between network idle and a timer.
 *
 * Pass an object containing:
 * - `page` - A puppeteer browser page
 * - `site` - An object containing a website's data and configs
 * - `requestCount` - A number for max allowable network requests
 * - `timeout` - A number in milliseconds to timeout
 * @param {Object} args
 * @param {Object} args.page
 * @param {Object} args.site
 * @param {number} args.requestCount
 * @param {number} args.timeout
 * @returns The results of the race
 */
const waitForLoad = async ({ page, site, requestCount, timeout }) => {
    logger.info(`${site.id}: Waiting on race condition...`);

    const networkIdle = `networkidle${requestCount}`;
    const networkPromise = new Promise((resolve, reject) => {
        page.waitForNavigation({ waitUntil: networkIdle })
            .then((results) => {
                resolve(`networkPromise resolved: ${results}`);
            })
            .catch((error) => {
                reject(`networkPromise rejected: ${error.stack}`);
            });
    });
    const timeoutPromise = waitForTimeout({
        timeout,
        message: 'Timeout Reached',
    });

    const raceResults = await Promise.race([networkPromise, timeoutPromise]);
    logger.info(`${site.id}: raceResults: `, raceResults);
    return raceResults;
};

module.exports = {
    generateDateTuples,
    getLastStatementDate,
    getLatestTuples,
    joinSiteIDAndAccount,
    parseLuxonsFromTuples,
    setLastStatementDate,
    splitMultiAccountSite,
    transferStatements,
    waitForChecksum,
    waitForLoad,
};
