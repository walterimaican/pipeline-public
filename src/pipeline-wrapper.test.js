const _ = require('lodash');
const fs = require('fs');
const path = require('path');

const configUtilPath = './services/config-utils/config-utils';
const utilsPath = './services/utils/utils';

const utils = require(utilsPath);
const { getConfig } = require(configUtilPath);

const config = getConfig();
const runNumberPath = path.join(
    config.pipelinePath,
    config.relativePaths.runNumberJSON,
);
const mockNumber = 0;
const runNumberSpy = jest.fn(() => ({ runNumber: mockNumber }));

const waitForEndResults = {
    exitCode: 0,
    killed: false,
};
const observableProcessMock = {
    start: () => ({
        output: { on: () => ({}) },
        waitForEnd: () => {
            return new Promise((resolve) => {
                resolve(waitForEndResults);
            });
        },
    }),
};

const prematurePipelineMessage = 'Pipeline ended prematurely... Exiting.';

const mockConfig = _.cloneDeep(config);
mockConfig.relativePaths.pipelineJS = 'mock-pipeline.js';

describe('pipeline-wrapper', () => {
    jest.doMock(runNumberPath, () => runNumberSpy());
    jest.doMock(configUtilPath, () => ({ getConfig: () => mockConfig }));
    jest.doMock('observable-process', () => observableProcessMock);

    // Prevent overwriting runNumber
    jest.spyOn(fs, 'writeFileSync').mockImplementation();

    const observableProcess = require('observable-process');
    const childStartSpy = jest.spyOn(observableProcess, 'start');
    const execWrapperSpy = jest
        .spyOn(utils, 'execWrapper')
        .mockImplementation();
    const consoleSpy = jest.spyOn(console, 'log');

    require('./pipeline-wrapper');

    test('should increment runNumber by one', () => {
        expect(runNumberSpy.mock.results[0].value).toEqual({
            runNumber: mockNumber + 1,
        });
    });

    test('should start an observable process with proper arguments', () => {
        const pipelineJsPath = path.join(
            mockConfig.pipelinePath,
            mockConfig.relativePaths.pipelineJS,
        );
        const scriptArg = `node ${pipelineJsPath}`;
        const optionalObject = {
            env: { NODE_ENV: 'test', RUN_NUMBER: mockNumber },
        };
        expect(childStartSpy).toHaveBeenCalledWith(scriptArg, optionalObject);
    });

    const cases = [
        ['===================================='],
        [`MAIN PROCESS ENDED WITH EXIT CODE: ${waitForEndResults.exitCode}`],
        [`MAIN PROCESS WAS KILLED: ${waitForEndResults.killed}`],
        ['ATTEMPTING TO COMMIT AND PUSH LOGS.'],
    ];

    test.each(cases)(
        'should emit %s when child process completes',
        (emission) => {
            expect(consoleSpy).toHaveBeenCalledWith(emission);
        },
    );

    test('should attempt to execute command to push logs', () => {
        expect(execWrapperSpy).toHaveBeenCalledWith(
            utils.generatePushCommand(mockNumber, 'logs'),
            false,
        );
    });

    test('should catch any errors during log pushing', () => {
        const rejectedValue = 'Rejected string!';
        const badExecWrapper = jest.fn().mockRejectedValue(rejectedValue);
        const mockUtils = _.cloneDeep(utils);
        mockUtils.execWrapper = badExecWrapper;

        jest.resetModules();
        jest.doMock(utilsPath, () => mockUtils);
        require('./pipeline-wrapper');

        expect(consoleSpy).toHaveBeenLastCalledWith(prematurePipelineMessage);
    });

    test('should catch general errors', () => {
        const badObservableProcessMock = {
            start: () => ({}),
        };

        jest.resetModules();
        jest.doMock('observable-process', () => badObservableProcessMock);
        require('./pipeline-wrapper');

        expect(consoleSpy).toHaveBeenLastCalledWith(prematurePipelineMessage);
    });
});
