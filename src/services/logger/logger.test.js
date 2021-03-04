const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

const configUtilPath = '../config-utils/config-utils';
const { getConfig } = require(configUtilPath);

const config = getConfig();
const defaultEnvironment = process.env;
const testIgnoreDirectory = path.join(
    config.pipelinePath,
    config.relativePaths.testOutput,
);
const runNumber = 'TEST';
const mockTime = DateTime.local().toISODate();
const mockLogFile = `Log_${runNumber}_Ran_${mockTime}.log`;
const mockConfig = _.cloneDeep(config);
mockConfig.relativePaths.logs = testIgnoreDirectory;
jest.doMock(configUtilPath, () => ({ getConfig: () => mockConfig }));

// Timestamp is not tested as that would require spying on the File stream
describe('logger', () => {
    beforeAll(() => {
        fs.mkdirSync(testIgnoreDirectory, { recursive: true });
    });

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...defaultEnvironment };
        process.env.RUN_NUMBER = runNumber;
    });

    test('should pipe to Console if NODE_ENV is dev', () => {
        process.env.NODE_ENV = 'dev';
        const logger = require('./logger');

        expect(logger.transports).toHaveLength(1);
        expect(logger.transports[0]).toHaveProperty('name', 'console');
    });

    // This test generates a log file but only after test execution is complete.
    // Routing to ignored dummy directory instead of cleaning up afterwards.
    test('should pipe to both Console and File if NODE_ENV is prod', () => {
        process.env.NODE_ENV = 'prod';
        const logger = require('./logger');

        const transports = logger.transports;
        expect(transports).toHaveLength(2);
        expect(transports[0]).toHaveProperty('name', 'console');
        expect(transports[1]).toHaveProperty('name', 'file');
        expect(transports[1]).toHaveProperty('dirname', testIgnoreDirectory);
        expect(transports[1]).toHaveProperty('filename', mockLogFile);
    });

    test('should print with log level', () => {
        process.env.NODE_ENV = 'dev';
        const consoleSpy = jest.spyOn(console._stdout, 'write');
        const logger = require('./logger');

        const testString = 'My mock string!';
        // Includes winston color formatting and windows carriage return
        const outputString = `\x1B[32minfo\x1B[39m: ${testString}\r\n`;
        logger.info(testString);

        expect(consoleSpy).toHaveBeenCalledWith(outputString);
    });

    test('should print objects when passed as second argument', () => {
        process.env.NODE_ENV = 'dev';
        const consoleSpy = jest.spyOn(console._stdout, 'write');
        const logger = require('./logger');

        const testObject = {
            testKey: 'testValue',
            testBoolean: true,
            testNumber: 123,
        };

        logger.info('Test Object: ', testObject);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining(JSON.stringify(testObject)),
        );

        logger.info('', null);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('null'),
        );
    });
});
