const _ = require('lodash');

/* Mocks */
const mockConfig = {
    externalPaths: {
        volume: 'mockVolume',
    },
    veracryptDrive: 'mockDrive',
};
const mockSitesConfig = 'mockSitesConfig';
const mockConfigUtil = {
    getConfig: () => mockConfig,
    getSitesConfig: () => mockSitesConfig,
};
const mockCopyVolumeToDrive = jest.fn();
const mockFullBackup = jest.fn();
const mockDismountVolumesSafely = jest.fn();
const mockMountVolume = jest.fn();
const mockDocumentsPipeline = jest.fn();
const mockMoviesTvPipeline = jest.fn();
const mockMusicPipeline = jest.fn();
const mockPhotosPipeline = jest.fn();

jest.doMock('./services/config-utils/config-utils', () => mockConfigUtil);
jest.doMock('./services/backup/backup', () => ({
    copyVolumeToDrive: mockCopyVolumeToDrive,
    fullBackup: mockFullBackup,
}));
jest.doMock('./services/utils/utils', () => ({
    waitForInput: jest.fn(),
    waitForTimeout: jest.fn(),
}));
jest.doMock('./services/veracrypt/veracrypt', () => ({
    dismountVolumesSafely: mockDismountVolumesSafely,
    mountVolume: mockMountVolume,
}));
jest.doMock('./subroutines/documents-pipeline', () => mockDocumentsPipeline);
jest.doMock('./subroutines/moviesTV-pipeline', () => mockMoviesTvPipeline);
jest.doMock('./subroutines/music-pipeline', () => mockMusicPipeline);
jest.doMock('./subroutines/photos-pipeline', () => mockPhotosPipeline);

const consoleSpy = jest.spyOn(console._stdout, 'write');
const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

const utilsPath = './services/utils/utils';
const utils = require(utilsPath);
const mockUtils = _.cloneDeep(utils);
mockUtils.waitForTimeout = jest.fn().mockImplementation(() => {
    throw new Error('MOCK ERROR - IGNORE');
});

/* 
    It is essential to use the keyword 'async' when requiring this module.
    If it is not used, a race condition occurs in which the execution of the
    module is executing simultaneously as the tests execute.
 */
describe('pipeline happy path', () => {
    beforeAll(async () => {
        mockCopyVolumeToDrive.mockReturnValue(true);
        mockFullBackup.mockReturnValue(true);
        consoleSpy.mockClear();

        jest.resetModules();
        require('./pipeline');
    });

    test('should try to copy volume and inform if successful', () => {
        expect(mockCopyVolumeToDrive).toHaveBeenCalled();

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Successfully copied file over'),
        );
        expect(consoleSpy).not.toHaveBeenCalledWith(
            expect.stringContaining(
                'Copying was NOT successful - please review logs!',
            ),
        );
    });

    test('should try to backup and inform if successful', () => {
        expect(mockFullBackup).toHaveBeenCalled();

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Backup was successful!'),
        );
        expect(consoleSpy).not.toHaveBeenCalledWith(
            expect.stringContaining(
                'Backup was NOT successful - please review logs!',
            ),
        );
    });
});

/* 
    It is essential to use the keyword 'async' when requiring this module.
    If it is not used, a race condition occurs in which the execution of the
    module is executing simultaneously as the tests execute.
 */
describe('pipeline with warnings', () => {
    beforeAll(async () => {
        mockCopyVolumeToDrive.mockReturnValue(false);
        mockFullBackup.mockReturnValue(false);
        consoleSpy.mockClear();

        jest.resetModules();
        require('./pipeline');
    });

    test('should provide warnings to user', () => {
        [
            'Only run this pipeline locally. Running across a network connection is insecure.',
            'VPNs may trigger security pages and MFA requests for website logins - recommend turning off before continuing.',
        ].forEach((warning) => {
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(warning),
            );
        });
    });

    test('should log config and sites-config', () => {
        [JSON.stringify(mockConfig), JSON.stringify(mockSitesConfig)].forEach(
            (config) => {
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining(config),
                );
            },
        );
    });

    test('should mount Veracrypt volume', () => {
        expect(mockMountVolume).toHaveBeenCalledWith(
            mockConfig.externalPaths.volume,
            mockConfig.veracryptDrive,
        );
    });

    test('should call pipeline subroutines', () => {
        [
            mockDocumentsPipeline,
            mockMoviesTvPipeline,
            mockMusicPipeline,
            mockPhotosPipeline,
        ].forEach((subroutine) => {
            expect(subroutine).toHaveBeenCalled();
        });
    });

    test('should dismount Veracrypt volume', () => {
        expect(mockDismountVolumesSafely).toHaveBeenCalled();
    });

    test('should try to copy volume and warn if unsuccessful', () => {
        expect(mockCopyVolumeToDrive).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Copying was NOT successful - please review logs!',
            ),
        );
        expect(consoleSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('Successfully copied file over'),
        );
    });

    test('should try to backup and warn if unsuccessful', () => {
        expect(mockFullBackup).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Backup was NOT successful - please review logs!',
            ),
        );
        expect(consoleSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('Backup was successful!'),
        );
    });

    test('should exit without fully completing if in dev', async () => {
        const defaultEnvironment = process.env;
        process.env.NODE_ENV = 'dev';
        jest.resetModules();

        mockDismountVolumesSafely.mockClear();
        require('./pipeline');

        expect(mockMountVolume).toHaveBeenCalled();
        expect(mockDismountVolumesSafely).not.toHaveBeenCalled();

        process.env = { ...defaultEnvironment };
        jest.resetModules();
    });

    test('should catch errors', async () => {
        jest.unmock(utilsPath);
        jest.doMock('./services/utils/utils', () => mockUtils);
        jest.resetModules();
        require('./pipeline');

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('PIPELINE ERROR: '),
        );
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });
});
