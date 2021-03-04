const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../../../config/config.yaml');
const sitesConfigPath = path.join(
    __dirname,
    '../../../config/sites-config.yaml',
);

/* Mocks */
const mockYAML = `---
myElement:
    myKey: myValue
myArray:
    - first
    - second`;
const mockJSON = {
    myElement: { myKey: 'myValue' },
    myArray: ['first', 'second'],
};

describe('config-utils', () => {
    let readFileSyncSpy;

    beforeEach(() => {
        readFileSyncSpy = jest
            .spyOn(fs, 'readFileSync')
            .mockImplementation()
            .mockReturnValue(mockYAML);
        jest.resetModules();
    });

    afterEach(() => {
        readFileSyncSpy.mockRestore();
    });

    test('getConfig should get and return the config YAML as JSON', () => {
        const { getConfig } = require('./config-utils');
        expect(getConfig()).toEqual(mockJSON);
        expect(readFileSyncSpy).toHaveBeenCalledWith(configPath, 'utf-8');
    });

    test('getSitesConfig should get and return the config YAML as JSON', () => {
        const { getSitesConfig } = require('./config-utils');
        expect(getSitesConfig()).toEqual(mockJSON);
        expect(readFileSyncSpy).toHaveBeenCalledWith(sitesConfigPath, 'utf-8');
    });
});
