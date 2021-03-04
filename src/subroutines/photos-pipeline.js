const open = require('open');

const logger = require('../services/logger/logger');
const {
    waitForInput,
    execWrapper,
    generateRenameCommand,
} = require('../services/utils/utils');
const { getConfig } = require('../services/config-utils/config-utils');

const config = getConfig();

/**
 * A subroutine that will execute tasks related to photos
 * @param {string} separator Pass a commonly used logs separator
 */
const photosPipeline = async (separator) => {
    logger.info('Running photos pipeline.');
    logger.info(separator);

    // Manual import
    await waitForInput('> Please connect device and press [ENTER] <');
    logger.info('Please manually perform the following steps:');
    logger.info('\t- Right-click on device');
    logger.info('\t- Click on "Import pictures and videos"');
    logger.info('\t- Click on "More options"');
    logger.info('\t- Set the following:');
    logger.info(
        `\t\t"Import images to:" -> "${config.externalPaths.photosInput}"`,
    );
    logger.info(
        `\t\t"Import videos to:" -> "${config.externalPaths.photosInput}"`,
    );
    logger.info('\t\t"Folder name:" -> "Date Imported + Name"');
    logger.info('\t\t"File name:" -> "Date Taken + Name"');
    logger.info('\t\t"Other options:"');
    logger.info('\t\t\t-> "Open File Explorer after import"');
    logger.info('\t\t\t-> "Delete files from device after importing"');
    logger.info('\t\t\t-> "Rotate pictures on import"');
    logger.info('\t\tClick "OK"');
    logger.info('\t- Select "Import all new items now"');
    logger.info('\t- Click on "Import"');
    logger.info('Ensure that photos are located in a single directory');
    await waitForInput('> When import is complete, please press [ENTER] <');
    logger.info(separator);

    // Rename and place in correct directories
    logger.info(separator);
    const renamePhotosCommand = generateRenameCommand(
        config.externalPaths.photosInput,
        config.externalPaths.photosOutput,
    );
    await execWrapper(renamePhotosCommand, true);

    // Delete from cloud backup
    logger.info('Deleting from Google Photos');
    logger.info('Delete in increments of ~1000, holding shift while clicking');
    await waitForInput('> Opening Google Photos - press [ENTER] when ready <');
    await open(config.cloudPhotos);
    await waitForInput();
};

module.exports = photosPipeline;
