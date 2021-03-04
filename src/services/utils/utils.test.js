const readline = require('readline');

const {
    execWrapper,
    generateRenameCommand,
    waitForInput,
    waitForTimeout,
} = require('./utils');

describe('execWrapper', () => {
    const goodScript = 'ls';
    const badScript = 'mockcmd';
    const stderrMessage = `'${badScript}' is not recognized as an internal or external command,\r\noperable program or batch file.\r\n`;

    const resolveRejectCases = [
        ['true', 'a valid', goodScript, true],
        ['false', 'an invalid', badScript, false],
    ];

    test.each(resolveRejectCases)(
        'should resolve to %s if given %s script',
        async (_case, _caseCondition, script, resolvedValue) => {
            expect(await execWrapper(script, false)).toBe(resolvedValue);
        },
    );

    const routeCases = [
        ['the console', false],
        ['logger', true],
    ];
    test.each(routeCases)('should route to %s', async (_case, useLogger) => {
        const logSpy = jest.spyOn(console, 'log');
        const errorSpy = jest.spyOn(console, 'error');
        await execWrapper(badScript, useLogger);

        const logSpyArgs = ['Running script: ', badScript];
        expect(logSpy).toHaveBeenLastCalledWith(logSpyArgs[0], logSpyArgs[1]);
        expect(errorSpy).toHaveBeenLastCalledWith(stderrMessage);
    });
});

describe('generatePushCommand', () => {
    const mockConfig = {
        wrapperConfigs: {
            commitFork: 'mockFork',
            commitBranch: 'mockBranch',
        },
        pipelinePath: 'mockPipelinePath',
        relativePaths: {
            data: 'mockData',
            logs: 'mockLogs',
            pushCommitsShell: 'mockShell',
        },
    };
    const mockConfigUtil = {
        getConfig: () => mockConfig,
    };
    jest.doMock('../config-utils/config-utils', () => mockConfigUtil);
    jest.resetModules();
    const { generatePushCommand } = require('./utils');

    const cases = [
        [
            0,
            'logs',
            'sh mockPipelinePath\\mockShell mockPipelinePath\\mockLogs Prod_0_logs mockFork mockBranch',
        ],
        [
            1,
            'logs',
            'sh mockPipelinePath\\mockShell mockPipelinePath\\mockLogs Prod_1_logs mockFork mockBranch',
        ],
        [
            1234,
            'logs',
            'sh mockPipelinePath\\mockShell mockPipelinePath\\mockLogs Prod_1234_logs mockFork mockBranch',
        ],
        [
            5001,
            'data',
            'sh mockPipelinePath\\mockShell mockPipelinePath\\mockData Prod_5001_data mockFork mockBranch',
        ],
    ];

    test.each(cases)(
        'should return a git command with the number %s and directory %s as part of the commit',
        (runNumber, directory, gitCommand) => {
            expect(generatePushCommand(runNumber, directory)).toBe(gitCommand);
        },
    );
});

describe('generateRenameCommand', () => {
    test('should return the expected exiftool script', () => {
        const input = 'mockInput';
        const output = 'mockOutput';
        const expectedCommand = `exiftool -P -v -r -d ${output}\\%Y\\%Y-%m\\%Y-%m-%d_%H.%M.%S%%-c.%%e "-filename<FileModifyDate" "-filename<CreationDate" "-filename<DateTimeOriginal" ${input}`;

        expect(generateRenameCommand(input, output)).toEqual(expectedCommand);
    });
});

describe('waitForInput', () => {
    const readlineInterfaceOptions = {
        input: process.stdin,
        output: process.stdout,
        crlfDelay: Infinity,
    };
    const defaultQuery = '> Press [ENTER] to continue... <\n';
    const customQuery = 'Custom Query';
    const mockAnswer = 'Mock Answer';

    const questionSpy = jest.fn((_query, answerCallbackFn) => {
        answerCallbackFn(mockAnswer);
    });
    const closeSpy = jest.fn();
    const readlineSpy = jest
        .spyOn(readline, 'createInterface')
        .mockReturnValue({
            question: questionSpy,
            close: closeSpy,
        });

    const cases = [
        [defaultQuery, undefined],
        [customQuery, customQuery],
    ];

    test.each(cases)(
        'should use a readline interface and ask %s if given %s',
        async (expectedQuery, queryParameter) => {
            const answer = await waitForInput(queryParameter);

            expect(readlineSpy).toHaveBeenCalledWith(
                expect.objectContaining(readlineInterfaceOptions),
            );
            expect(questionSpy).toHaveBeenCalledWith(
                expectedQuery,
                expect.any(Function),
            );
            expect(closeSpy).toHaveBeenCalled();
            expect(answer).toBe(mockAnswer);
        },
    );
});

describe('waitForTimeout', () => {
    test('should return a promise', async () => {
        const message = 'Test Message';
        expect(await waitForTimeout({ timeout: 1000, message })).toBe(message);
    });
});
