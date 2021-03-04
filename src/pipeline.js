const documentsPipeline = require('./subroutines/documents-pipeline');
const logger = require('./services/logger/logger');
const moviesTvPipeline = require('./subroutines/moviesTV-pipeline');
const musicPipeline = require('./subroutines/music-pipeline');
const photosPipeline = require('./subroutines/photos-pipeline');
const {
    dismountVolumesSafely,
    mountVolume,
} = require('./services/veracrypt/veracrypt');
const {
    getConfig,
    getSitesConfig,
} = require('./services/config-utils/config-utils');
const { copyVolumeToDrive, fullBackup } = require('./services/backup/backup');
const { waitForInput, waitForTimeout } = require('./services/utils/utils');

const config = getConfig();
const sitesConfig = getSitesConfig();
const runningDev = process.env.NODE_ENV === 'dev';
const separator = '---------------------------------------------------------\n';

(async () => {
    try {
        // Reminders
        logger.warn(
            /* NodeJS uses HTTP sockets instead of HTTPS */
            'Only run this pipeline locally. Running across a network connection is insecure.',
        );
        await waitForTimeout({ timeout: 3000 });
        logger.warn(
            'VPNs may trigger security pages and MFA requests for website logins - recommend turning off before continuing.',
        );
        await waitForTimeout({ timeout: 3000 });
        logger.warn(separator);

        // Log configs
        logger.info('Starting Pipeline');
        logger.info(separator);
        logger.info('Config: ', config);
        logger.info(separator);
        logger.info('Sites Config: ', sitesConfig);
        logger.info(separator);

        // Mount VeraCrypt volume
        const volume = config.externalPaths.volume;
        const drive = config.veracryptDrive;
        await mountVolume(volume, drive);
        logger.info(separator);

        // Run Pipeline subroutines - run in sequence for log clarity
        await documentsPipeline(separator);
        logger.info(separator);
        await moviesTvPipeline(separator);
        logger.info(separator);
        await musicPipeline(separator);
        logger.info(separator);
        await photosPipeline(separator);
        logger.info(separator);

        /* If developing, exit here */
        if (runningDev) return;

        // Dismount VeraCrypt volumes after waiting for user confirmation
        logger.info('Dismounting volumes - please finalize VeraCrypt changes.');
        await waitForInput();
        await dismountVolumesSafely();

        // Copy VeraCrypt volume to jump drive
        const copySuccessful = await copyVolumeToDrive();
        copySuccessful
            ? logger.info('Successfully copied file over')
            : logger.warn('Copying was NOT successful - please review logs!');

        // Backup to local drive and cloud
        const backupSuccessful = await fullBackup();
        backupSuccessful
            ? logger.info('Backup was successful!')
            : logger.warn('Backup was NOT successful - please review logs!');

        // Finish Pipeline
        logger.info('Pipeline Completed!');
        waitForInput();
    } catch (error) {
        logger.error('PIPELINE ERROR: ', error.stack);
        process.exit(1);
    }
})();
