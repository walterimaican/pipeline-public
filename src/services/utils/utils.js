const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

const logger = require('../logger/logger');
const { getConfig } = require('../config-utils/config-utils');

const config = getConfig();

/**
 * Wrapper function to spawn child process based on script.
 * @param {string} script A script that NodeJS will spawn.
 * @param {boolean} useLogger Flag to switch between logger vs console use.
 * @returns {Promise<boolean>} Execution status of script - `true` if successful, `false` otherwise
 */
const execWrapper = async (script, useLogger) => {
    const logObjectInfo = useLogger ? logger.info : console.log;
    const logObjectError = useLogger ? logger.error : console.error;

    let returnStatus;
    await new Promise((resolve) => {
        logObjectInfo('Running script: ', script);
        let resolveStatus = true;

        exec(script, (error, stdout, stderr) => {
            if (error && error.message) {
                logObjectError(error.message);
                resolveStatus = false;
            }
            if (stderr) {
                logObjectError(stderr);
                resolveStatus = false;
            }
            if (stdout) {
                logObjectInfo(stdout);
            }

            resolve(resolveStatus);
        });
    }).then((resolveStatus) => (returnStatus = resolveStatus));

    return returnStatus;
};

/**
 * Function to generate a shell script for pushing prod logs.
 * @param {number} runNumber Prod execution number (ie. 1, 2, etc.).
 * @param {string} sourceKey Config key for source directory
 * @returns {string} Shell script.
 */
const generatePushCommand = (runNumber, sourceKey) => {
    const pushCommitsShell = path.join(
        config.pipelinePath,
        config.relativePaths.pushCommitsShell,
    );
    const source = path.join(
        config.pipelinePath,
        config.relativePaths[sourceKey],
    );
    const commitMessage = `Prod_${runNumber}_${sourceKey}`;
    const commitFork = config.wrapperConfigs.commitFork;
    const commitBranch = config.wrapperConfigs.commitBranch;
    return `sh ${pushCommitsShell} ${source} ${commitMessage} ${commitFork} ${commitBranch}`;
};

/**
 * Function to generate a shell script for renaming photos
 * @param {string} inputDirectory Path of source photos
 * @param {string} outputDirectory Path of destination photos
 * @returns {string} Shell script
 */
const generateRenameCommand = (inputDirectory, outputDirectory) => {
    /*
    exiftool -time:all [file] => gets all timestamps
    exiftool -s [file] => gets all tag names
    exiftool -[tagname] [file] => gets the timestamp associated with given tag

    Tag Names:
        - FileModifyDate:
            A known universal timestamp that all files will have (fallback)
        - CreationDate:
            Used in .mov files (preferred)
        - DateTimeOriginal:
            Used in .png, .jpg, .jpeg, and potentially more files (preferred)

    CLI Args:
        -P: Preserve existing tags
        -v: Verbose
        -r: Recursive
        -d: Date format
    */

    // Rename to outputDirectory/yyyy/yyyy-mm/yyyy-mm-dd_hh.mm.ss(-1).ext from given inputDirectory
    // The (-1) allows for named copies for files of identical name ie.
    // 2000-01-01_00.00.01.jpg, 2000-01-01_00.00.01-1.jpg, 2000-01-01_00.00.01-2.jpg, ...
    const outputFormat = path.join(
        outputDirectory,
        '%Y',
        '%Y-%m',
        '%Y-%m-%d_%H.%M.%S%%-c.%%e',
    );

    // Use timestamps as new file name, in order of preference
    return `exiftool -P -v -r -d ${outputFormat} "-filename<FileModifyDate" "-filename<CreationDate" "-filename<DateTimeOriginal" ${inputDirectory}`;
};

/**
 * Function to wait for user input to continue program execution.
 * The default prompt is :
 * `> Press [ENTER] to continue... <\n`
 * @param {string=} optionalQuery An optional question to prompt the user
 * (overrides default prompt).
 * @returns {Promise<string>} Returns user response.
 */
const waitForInput = async (optionalQuery) => {
    const continueQuery = '> Press [ENTER] to continue... <\n';
    const query = optionalQuery ?? continueQuery;

    const readlineInterface = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        crlfDelay: Infinity,
    });

    return new Promise((resolve) => {
        readlineInterface.question(query, (answer) => {
            readlineInterface.close();
            resolve(answer);
        });
    });
};

/**
 * Function to wrap delays.
 *
 * Pass an object containing:
 * - `timeout` - A number in milliseconds to timeout
 * - `message` - An optional string to display after timeout
 * @param {Object} Options
 * @param {number} Options.timeout
 * @param {string=} Options.message
 * @returns {Promise<any>} Returns a promise wrapped around setTimeout
 */
const waitForTimeout = async ({ timeout, message }) => {
    return new Promise((resolve) => {
        setTimeout(resolve, timeout, message);
    });
};

module.exports = {
    execWrapper,
    generatePushCommand,
    generateRenameCommand,
    waitForInput,
    waitForTimeout,
};
