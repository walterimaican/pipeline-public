const logger = require('../services/logger/logger');

/**
 * A subroutine that will execute tasks related to movies and tv shows
 * @param {string} separator Pass a commonly used logs separator
 */
const moviesTvPipeline = async (separator) => {
    logger.info('Running moviesTV pipeline.');
    logger.info(separator);
};

module.exports = moviesTvPipeline;
