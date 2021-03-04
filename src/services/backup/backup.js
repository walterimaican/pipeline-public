const path = require('path');

const logger = require('../logger/logger');
const { execWrapper, waitForInput } = require('../utils/utils');
const { getConfig } = require('../config-utils/config-utils');

const config = getConfig();
const rclone = config.rclone;

/**
 * A function to have the user connect an external drive and
 * returns the drive letter.
 * @param {string} purpose String that completes: `Please connect external drive for: `
 * @returns Letter of the drive that was connected
 */
const connectDrive = async (purpose) => {
    logger.info(`Please connect external drive for: ${purpose}`);

    const isLetterRE = new RegExp('^[a-zA-Z]$');
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const driveLetter = await waitForInput('Enter the drive letter: ');

        if (isLetterRE.test(driveLetter)) {
            return driveLetter;
        }

        logger.warn(`'${driveLetter}' is not a letter...`);
    }
};

/**
 * A function to copy the Veracrypt volume to an external jump drive via rclone
 */
const copyVolumeToDrive = async () => {
    try {
        const copyVolumePurpose = 'copying Veracrypt volume to laptop';
        const jumpDriveLetter = await moduleExports.connectDrive(
            copyVolumePurpose,
        );

        const sourcePath = config.externalPaths.volume;
        const volumeName = path.basename(sourcePath);
        const destinationPath = path.join(`${jumpDriveLetter}:`, volumeName);

        logger.info(`Will copy ${sourcePath} to ${destinationPath}`);
        logger.info('Please finalize ALL changes.');
        await waitForInput();

        const rcloneScript = `${rclone.baseScript} ${sourcePath} ${destinationPath} ${rclone.additionalFlags.local}`.trim();
        return await execWrapper(rcloneScript, true);
    } catch (error) {
        logger.error('Error transferring: ', error.stack);
        return false;
    }
};

/**
 * A function to use rclone to backup data to both
 * a local drive and a cloud endpoint.
 */
const fullBackup = async () => {
    try {
        logger.info('Initiating full backup to local drive and cloud.');
        const fullBackupPurpose = 'full backup';
        const driveLetter = await moduleExports.connectDrive(fullBackupPurpose);
        const localDestination = `${driveLetter}:\\${rclone.destination.local}`;
        const cloudDestination = rclone.destination.cloud;

        logger.info('Will backup to: ');
        logger.info('Local: ', localDestination);
        logger.info('Cloud: ', cloudDestination);
        logger.info(
            'Backup will occur after this - please finalize ALL changes.',
        );
        await waitForInput();

        const rcloneSourceScript = `${rclone.baseScript} ${rclone.source}`;
        const rcloneLocalScript = `${rcloneSourceScript} ${localDestination} ${rclone.additionalFlags.local}`.trim();
        const rcloneCloudScript = `${rcloneSourceScript} ${cloudDestination} ${rclone.additionalFlags.cloud}`.trim();
        const rclonePromises = [
            execWrapper(rcloneLocalScript, true),
            execWrapper(rcloneCloudScript, true),
        ];

        return await Promise.allSettled(rclonePromises)
            .then((results) => {
                logger.info('Rclone local synced: ', results[0].value);
                logger.info('Rclone cloud synced: ', results[1].value);
                return true;
            })
            .catch((error) => {
                logger.error('Error during parallel backup: ', error.stack);
                return false;
            });
    } catch (error) {
        logger.error('Error backing up: ', error.stack);
        return false;
    }
};

const moduleExports = {
    connectDrive,
    copyVolumeToDrive,
    fullBackup,
};
module.exports = moduleExports;
