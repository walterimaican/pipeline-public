const path = require('path');

const logger = require('../logger/logger');
const utils = require('../utils/utils');
const { getConfig } = require('../config-utils/config-utils');

const config = getConfig();

/**
 * Function to safely dismount VeraCrypt volumes.
 * Loops if encounters a problem, prompting user to fix or force dismount.
 */
const dismountVolumesSafely = async () => {
    logger.info('Dismounting all VeraCrypt volumes');
    const dismountScript = 'veracrypt /d /q';

    let areVolumesDismounted = false;
    while (!areVolumesDismounted) {
        areVolumesDismounted = await utils.execWrapper(dismountScript, true);
    }
};

/**
 * Function to get the contents of a JSON in the encrypted volume.
 * @param {string} jsonName The key in config pointing to the desired JSON
 * @returns {Object} { `jsonPath`, `jsonData` } => `jsonPath` is the path to the data in `jsonData`
 */
const getDataFromVolume = (jsonName) => {
    const jsonPath = path.join(
        config.veracryptDrive + ':',
        config.veracryptPaths[jsonName],
    );
    logger.info(`Retrieving ${jsonName} from ${jsonPath}`);
    const jsonData = require(jsonPath);
    return { jsonPath, jsonData };
};

/**
 * Wrapper function to mount a VeraCrypt volume. Runs a Windows batch command.
 * Loops until volume successfully mounted.
 * @param {string} volume Location of VeraCrypt volume.
 * @param {string} drive Drive letter on which volume will be mounted.
 */
const mountVolume = async (volume, drive) => {
    logger.info(`Attempting to mount volume '${volume}' on drive '${drive}'`);
    const mountScript = `veracrypt /v ${volume} /l ${drive} /q`;

    let isVolumeMounted = false;
    while (!isVolumeMounted) {
        isVolumeMounted = await utils.execWrapper(mountScript, true);
    }
};

module.exports = {
    dismountVolumesSafely,
    getDataFromVolume,
    mountVolume,
};
