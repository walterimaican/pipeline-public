const path = require('path');

const { execWrapper, waitForInput } = require('../utils/utils');
const { getConfig } = require('../config-utils/config-utils');

const config = getConfig();
const rclone = config.rclone;

jest.mock('../utils/utils', () => ({
    execWrapper: jest.fn(),
    waitForInput: jest.fn(),
}));

describe('connectDrive', () => {
    const mockPurpose = 'mockPurpose';
    const loopBreaker = 'Z';

    const cases = [
        [loopBreaker, '8', 'invalid'],
        [loopBreaker, 'drive', 'invalid'],
        [loopBreaker, 'ab', 'invalid'],
        [loopBreaker, '!', 'invalid'],
        [loopBreaker, '', 'invalid'],
        [loopBreaker, ' ', 'invalid'],
        ['c', 'c', 'valid'],
        ['D', 'D', 'valid'],
    ];
    test.each(cases)(
        "should return '%s' if user enters '%s' as drive letter, which is %s.",
        async (expectedLetter, userInput) => {
            waitForInput
                .mockImplementation()
                .mockReturnValueOnce(userInput)
                .mockReturnValueOnce(loopBreaker);
            const { connectDrive } = require('./backup');

            const actualLetter = await connectDrive(mockPurpose);
            expect(actualLetter).toEqual(expectedLetter);

            waitForInput.mockReset();
        },
    );
});

describe('copyVolumeToDrive', () => {
    const mockDrive = 'mockDrive';

    beforeEach(() => {
        const backup = require('./backup');
        jest.spyOn(backup, 'connectDrive')
            .mockImplementation()
            .mockReturnValue(mockDrive);
    });

    test('should attempt to execute proper rclone script and return true if successful', async () => {
        const mockSource = config.externalPaths.volume;
        const mockDestination = path.join(
            `${mockDrive}:`,
            path.basename(mockSource),
        );
        const expectedScript = `${rclone.baseScript} ${mockSource} ${mockDestination} ${rclone.additionalFlags.local}`.trim();

        execWrapper.mockImplementation().mockReturnValue(true);
        const { copyVolumeToDrive } = require('./backup');

        const copySuccessful = await copyVolumeToDrive();
        expect(copySuccessful).toBe(true);
        expect(execWrapper).toHaveBeenCalledWith(expectedScript, true);
    });

    test('should return false if it encounters an error', async () => {
        execWrapper.mockImplementation(() => {
            throw new Error('TEST ERROR - IGNORE');
        });
        const { copyVolumeToDrive } = require('./backup');

        const copySuccessful = await copyVolumeToDrive();
        expect(copySuccessful).toBe(false);
    });
});

describe('fullBackup', () => {
    const mockDrive = 'mockDrive';
    const expectedLocal = `${rclone.baseScript} ${rclone.source} ${mockDrive}:\\${rclone.destination.local} ${rclone.additionalFlags.local}`.trim();
    const expectedCloud = `${rclone.baseScript} ${rclone.source} ${rclone.destination.cloud} ${rclone.additionalFlags.cloud}`.trim();

    beforeEach(() => {
        const backup = require('./backup');
        jest.spyOn(backup, 'connectDrive')
            .mockImplementation()
            .mockReturnValue(mockDrive);
    });

    test('should attempt to backup to the right locations and return true if successful', async () => {
        execWrapper.mockImplementation();
        const { fullBackup } = require('./backup');

        const backupSuccessful = await fullBackup();
        expect(backupSuccessful).toBe(true);
        expect(execWrapper).toHaveBeenCalledWith(expectedLocal, true);
        expect(execWrapper).toHaveBeenCalledWith(expectedCloud, true);
    });

    test('should return false if it encounters an error', async () => {
        execWrapper.mockImplementation(() => {
            throw new Error('TEST ERROR - IGNORE');
        });
        const { fullBackup } = require('./backup');

        const backupSuccessful = await fullBackup();
        expect(backupSuccessful).toBe(false);
    });
});
