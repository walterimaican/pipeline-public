const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

/**
 * Function to retrieve config as a workable JSON from YAML.
 */
const getConfig = () => {
    const configPath = path.join(__dirname, '../../../config/config.yaml');
    const configFile = fs.readFileSync(configPath, 'utf-8');
    return YAML.parse(configFile);
};

/**
 * Function to retrieve sites-config as a workable JSON from YAML.
 */
const getSitesConfig = () => {
    const sitesConfigPath = path.join(
        __dirname,
        '../../../config/sites-config.yaml',
    );
    const sitesConfigFile = fs.readFileSync(sitesConfigPath, 'utf-8');
    return YAML.parse(sitesConfigFile);
};

module.exports = {
    getConfig,
    getSitesConfig,
};
