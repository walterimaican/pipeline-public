const logger = require('../logger/logger');
const { waitForLoad } = require('./site-utils');
const { waitForTimeout } = require('../utils/utils');

/**
 * A function to handle MFA process during login.
 *
 * Pass an object containing:
 * - `page` - A puppeteer browser page
 * - `site` - An object containing a website's data and configs
 * @param {Object} args
 * @returns {Promise<boolean>} A promise that resolves to a boolean: `true` if MFA was handled, `false` otherwise
 */
const handleMFA = async ({ page, site }) => {
    try {
        logger.info(`${site.id}: Handling MFA`);
        let attemptMFA = true;

        while (attemptMFA) {
            /*
             * This reducer resolves MFA elements sequentially via Promise.resolve()
             * Errors are resolved false instead of rejecting due to how reduce works
             * There is a 1 second gap between steps and retries in place as needed
             */
            const mfaStepsAllPassed = await site.login.mfa.reduce(
                async (promise, mfaStep) => {
                    // If MFA element missing, propogate failure through reducer
                    const previousStepSuccessful = await promise;
                    if (!previousStepSuccessful) Promise.resolve(false);

                    logger.info(`${site.id}: mfaStep: `, mfaStep);
                    return new Promise((resolve) => {
                        // Delay each step by 1 second (prevent moving too fast)
                        waitForTimeout({
                            timeout: 1000,
                        }).then(() => {
                            page.waitForSelector(mfaStep)
                                .then(() => {
                                    page.click(mfaStep)
                                        .then(() => {
                                            resolve(true);
                                        })
                                        .catch(() => {
                                            logger.warn(
                                                `${site.id}: Can't click mfaStep ${mfaStep}, retrying!`,
                                            );

                                            page.click(mfaStep)
                                                .then(() => {
                                                    logger.info(
                                                        `${site.id}: mfaStep ${mfaStep} retry succeeded!`,
                                                    );
                                                    resolve(true);
                                                })
                                                .catch((error) => {
                                                    logger.error(
                                                        `${site.id}: mfaStep ${mfaStep} - found selector but cannot click: `,
                                                        error.stack,
                                                    );
                                                });
                                        });
                                })
                                .catch((error) => {
                                    logger.error(
                                        `${site.id}: Cannot find selector for mfaStep ${mfaStep}: `,
                                        error.stack,
                                    );
                                    resolve(false);
                                });
                        });
                    });
                },
                Promise.resolve(true),
            );

            // MFA elements not present - stop MFA process
            if (!mfaStepsAllPassed) {
                logger.warn(`${site.id}: Are MFA elements on page?`);
                return true;
            }

            /* TODO - Automate email code */

            // No need to check if MFA request was sent - skip verification steps
            if (!site.login.mfaSentValidationMethod) {
                logger.info(`${site.id}: MFA request sent (unverified)`);
                attemptMFA = false;
                break;
            }

            // Otherwise, verify MFA request was sent and repeat if not
            logger.info(`${site.id}: Checking if MFA request was sent`);
            await page.waitForNavigation();

            const actualText = await page.$eval(
                site.login.mfaSentElementSelector,
                (element, property) => {
                    return element[property];
                },
                site.login.mfaSentValidationMethod,
            );

            logger.info(`${site.id}: MFA sent ACTUAL text: `, actualText);
            logger.info(
                `${site.id}: MFA sent EXPECTED text: `,
                site.login.mfaSuccessfullySentText,
            );
            const wasRequestSent =
                site.login.mfaSuccessfullySentText === actualText;

            logger.info(`${site.id}: wasRequestSent: `, wasRequestSent);
            attemptMFA = !wasRequestSent;
        }

        // Poll for user to complete MFA
        while (!page.url().includes(site.login.link)) {
            logger.info(`${site.id}: Waiting for user to resolve MFA`);
            await waitForTimeout({ timeout: 5000 });
        }
        logger.info(`${site.id}: Login page reached after MFA`);

        return true;
    } catch (error) {
        logger.error(`${site.id}: Error occurred during mfa: `, error.stack);
        return false;
    }
};

/**
 * A function to handle logging into a website.
 *
 * Pass an object containing:
 * - `page` - A puppeteer browser page
 * - `site` - An object containing a website's data and configs
 * - `credentials` - An object containing the credentials for `site`
 * @param {Object} args
 * @returns {Promise<boolean>} A promise that resolves to a boolean: `true` if login was successful, `false` otherwise
 */
const loginToSite = async ({ page, site, credentials }) => {
    try {
        logger.info(`${site.id}: Logging in`);

        // Pass basic HTTP/S authentication as needed
        await page.authenticate({
            username: credentials.username,
            password: credentials.password,
        });

        // Launch and set optional cookies
        await page.goto(site.login.link);
        if (site.login.cookie) await page.setCookie(site.login.cookie);

        // Login
        const contentHandle = site.login.iframe
            ? await (await page.$(site.login.iframe)).contentFrame()
            : page;
        await contentHandle.waitForSelector(site.login.usernameField);
        await contentHandle.click(site.login.usernameField);
        await contentHandle.type(
            site.login.usernameField,
            credentials.username,
        );
        await contentHandle.click(site.login.passwordField);
        await contentHandle.type(
            site.login.passwordField,
            credentials.password,
        );
        await contentHandle.click(site.login.loginButton);
        await page.waitForNavigation();

        // Optional MFA steps
        if (site.login.mfa) {
            const wasMFAHandled = await handleMFA({ page, site });
            logger.info(`${site.id}: wasMFAHandled: `, wasMFAHandled);
        }

        await waitForLoad({
            page,
            site,
            requestCount: 2,
            timeout: 8000,
        });

        // Security Page - Wait for user, while polling
        while (page.url().includes(site.login.securityPage)) {
            logger.info(
                `${site.id}: Waiting for user to resolve security page`,
            );
            await waitForTimeout({ timeout: 5000 });
        }

        return true;
    } catch (error) {
        logger.error(`${site.id}: Error logging in: `, error.stack);
        return false;
    }
};

module.exports = { loginToSite };
