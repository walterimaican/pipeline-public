const _ = require('lodash');
const path = require('path');

const utils = require('../utils/utils');
const { dismountVolumesSafely, mountVolume } = require('./veracrypt');

const configUtilPath = '../config-utils/config-utils';
const { getConfig } = require(configUtilPath);

const execWrapperSpy = jest.spyOn(utils, 'execWrapper').mockImplementation();

describe('dismountVolumesSafely', () => {
    test('should call execWrapper() until it returns true', async () => {
        execWrapperSpy.mockClear();
        execWrapperSpy
            .mockReturnValueOnce(false)
            .mockReturnValueOnce(false)
            .mockReturnValueOnce(true);

        const script = 'veracrypt /d /q';

        await dismountVolumesSafely();
        expect(execWrapperSpy).toHaveBeenCalledWith(script, true);
        expect(execWrapperSpy).toHaveBeenCalledTimes(3);
    });
});

describe('getDataFromVolume', () => {
    const config = getConfig();
    const mockConfig = _.cloneDeep(config);
    mockConfig.veracryptPaths.mock = 'MockDirectory/mockData.json';
    const mockPath = path.join(
        mockConfig.veracryptDrive + ':',
        mockConfig.veracryptPaths.mock,
    );
    const mockData = { mockKey: 'mockValue' };

    jest.doMock(configUtilPath, () => ({ getConfig: () => mockConfig }));
    jest.doMock(mockPath, () => mockData, { virtual: true });
    jest.resetModules();
    const { getDataFromVolume } = require('./veracrypt');

    test('should return a tuple with jsonPath and jsonData', () => {
        const jsonTuple = getDataFromVolume('mock');
        expect(jsonTuple).toHaveProperty('jsonPath', mockPath);
        expect(jsonTuple).toHaveProperty('jsonData', mockData);
    });
});

describe('mountVolume', () => {
    test('should call execWrapper() until it returns true', async () => {
        execWrapperSpy.mockClear();
        execWrapperSpy
            .mockReturnValueOnce(false)
            .mockReturnValueOnce(false)
            .mockReturnValueOnce(true);

        const volume = 'mockVolume';
        const drive = 'mockDrive';
        const script = `veracrypt /v ${volume} /l ${drive} /q`;

        await mountVolume(volume, drive);
        expect(execWrapperSpy).toHaveBeenCalledWith(script, true);
        expect(execWrapperSpy).toHaveBeenCalledTimes(3);
    });
});
