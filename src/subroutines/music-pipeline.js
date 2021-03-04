const logger = require('../services/logger/logger');

/**
 * A subroutine that will execute tasks related to music
 * @param {string} separator Pass a commonly used logs separator
 */
const musicPipeline = async (separator) => {
    logger.info('Running music pipeline.');
    logger.info(separator);
};

module.exports = musicPipeline;
