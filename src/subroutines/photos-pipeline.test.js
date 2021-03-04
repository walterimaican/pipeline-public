const mockConfigUtil = {
    getConfig: () => ({
        externalPaths: {
            photosInput: 'mockPhotosInput',
            photosOutput: 'mockPhotosOutput',
        },
        cloudPhotos: 'mockCloudPhotos',
    }),
};
const mockOpen = jest.fn();
const mockExecWrapper = jest.fn();
const mockGenerateRenameCommand = jest.fn().mockReturnValue('mockRename');
const mockWaitForInput = jest.fn();

jest.doMock('open', () => mockOpen);
jest.doMock('../services/config-utils/config-utils', () => mockConfigUtil);
jest.doMock('../services/utils/utils', () => ({
    execWrapper: mockExecWrapper,
    generateRenameCommand: mockGenerateRenameCommand,
    waitForInput: mockWaitForInput,
}));
const consoleSpy = jest.spyOn(console._stdout, 'write');

describe('photosPipeline', () => {
    beforeAll(async () => {
        const photosPipeline = require('./photos-pipeline');
        await photosPipeline();
    });

    test('should prompt for manual import', async () => {
        expect(mockWaitForInput).toHaveBeenCalledWith(
            expect.stringContaining(
                '> Please connect device and press [ENTER] <',
            ),
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('"Import images to:" -> "mockPhotosInput"'),
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('"Import videos to:" -> "mockPhotosInput"'),
        );
        expect(mockWaitForInput).toHaveBeenCalledWith(
            expect.stringContaining(
                '> When import is complete, please press [ENTER] <',
            ),
        );
    });

    test('should rename and organize photos', async () => {
        expect(mockGenerateRenameCommand).toHaveBeenCalledWith(
            'mockPhotosInput',
            'mockPhotosOutput',
        );
        expect(mockExecWrapper).toHaveBeenCalledWith('mockRename', true);
    });

    test('should prompt for manual cloud deletion', async () => {
        expect(mockWaitForInput).toHaveBeenCalledWith(
            expect.stringContaining(
                '> Opening Google Photos - press [ENTER] when ready <',
            ),
        );
        expect(mockOpen).toHaveBeenCalledWith('mockCloudPhotos');
    });
});
