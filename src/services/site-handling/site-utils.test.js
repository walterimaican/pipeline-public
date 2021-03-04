const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

const configUtilPath = '../config-utils/config-utils';
const { getConfig } = require(configUtilPath);

const config = getConfig();
const mocks = require('./site-utils-mocks.json');
const mockConfig = _.cloneDeep(config);
mockConfig.veracryptDrive = 'E';
mockConfig.veracryptPaths.financialsDirectory = path.join(
    config.pipelinePathNoDrive,
    config.relativePaths.testOutput,
);
const mockSitePath = path.join(
    config.pipelinePath,
    config.relativePaths.data,
    `${mocks.mockSite.id}${mocks.mockSite.statements.account}.json`,
);
const mockSiteNoAccountPath = path.join(
    config.pipelinePath,
    config.relativePaths.data,
    `${mocks.mockSiteNoAccount.id}.json`,
);
jest.doMock(mockSitePath, () => mocks.mockSiteJSON, { virtual: true });
jest.doMock(mockSiteNoAccountPath, () => mocks.mockSiteNoAccountJSON, {
    virtual: true,
});
jest.doMock(configUtilPath, () => ({
    getConfig: () => mockConfig,
}));
jest.resetModules();
const loggerInfoSpy = jest.spyOn(console._stdout, 'write');

const {
    generateDateTuples,
    getLastStatementDate,
    getLatestTuples,
    joinSiteIDAndAccount,
    parseLuxonsFromTuples,
    splitMultiAccountSite,
    transferStatements,
    waitForChecksum,
    waitForLoad,
} = require('./site-utils');

describe('generateDateTuples', () => {
    test('should return an array of tuples with raw text and parsed luxons given an array of raw date texts', () => {
        const dateTuples = generateDateTuples({
            rawTextList: mocks.rawTextList,
            site: mocks.generateDateTuplesSite,
        });
        expect(dateTuples).toEqual(expect.any(Array));

        dateTuples.forEach((tuple, index) => {
            expect(tuple).toHaveProperty('rawText', mocks.rawTextList[index]);
            expect(tuple).toHaveProperty('parsedLuxon');
            const serializedLuxon = tuple.parsedLuxon.toString();
            expect(serializedLuxon).toEqual(mocks.parsedLuxonList[index]);
        });
    });

    test('should extract date if embedded in string that cannot easily convert with Luxon', () => {
        const dateTuples = generateDateTuples({
            rawTextList: mocks.rawTextListLuxonRegex,
            site: mocks.generateDateTuplesLuxonRegexSite,
        });
        const serializedLuxon = dateTuples[0].parsedLuxon.toString();
        expect(serializedLuxon).toEqual(mocks.parsedLuxonListLuxonRegex[0]);
    });
});

describe('getLastStatementDate', () => {
    test('should return a DateTime object of the appropriate value', () => {
        const latestLuxon = getLastStatementDate(mocks.mockSite);
        expect(latestLuxon.constructor.name).toBe('DateTime');
        expect(latestLuxon.toString()).toEqual(mocks.mockSiteLuxon);
    });

    test('should find correct data if site has no account', () => {
        const latestLuxon = getLastStatementDate(mocks.mockSiteNoAccount);
        expect(latestLuxon.constructor.name).toBe('DateTime');
        expect(latestLuxon.toString()).toEqual(mocks.mockSiteNoAccountLuxon);
    });
});

describe('getLatestTuples', () => {
    const dateTuples = generateDateTuples({
        rawTextList: mocks.rawTextList,
        site: mocks.generateDateTuplesSite,
    });

    test('should return an array of tuples whose values are newer than given luxon', () => {
        const latestLuxon = DateTime.local(2001, 12, 31);
        const latestTuples = getLatestTuples({
            site: mocks.generateDateTuplesSite,
            dateTuples,
            latestLuxon,
        });

        expect(latestTuples).toHaveLength(mocks.rawTextList.length - 1);
        latestTuples.forEach((tuple, index) => {
            expect(tuple.rawText).toEqual(mocks.rawTextList[index + 1]);
        });
    });

    test('should return all tuples if latest date on file is empty', () => {
        const latestLuxon = DateTime.fromISO('');
        const latestTuples = getLatestTuples({
            site: mocks.generateDateTuplesSite,
            dateTuples,
            latestLuxon,
        });

        expect(latestTuples).toHaveLength(mocks.rawTextList.length);
        latestTuples.forEach((tuple, index) => {
            expect(tuple.rawText).toEqual(mocks.rawTextList[index]);
        });
    });
});

describe('joinSiteIDAndAccount', () => {
    const cases = [
        ['exists', mocks.mockSite, mocks.mockSiteJoined],
        [
            'does not exist',
            mocks.mockSiteNoAccount,
            mocks.mockSiteNoAccountJoined,
        ],
    ];

    test.each(cases)(
        'should return correct string if account %s',
        (_case, site, expectedString) => {
            expect(joinSiteIDAndAccount(site, ' ')).toEqual(expectedString);
        },
    );
});

describe('parseLuxonsFromTuples', () => {
    test('should return only the DateTimes from an array of tuples', () => {
        const dateTuples = generateDateTuples({
            rawTextList: mocks.rawTextList,
            site: mocks.generateDateTuplesSite,
        });
        const luxons = parseLuxonsFromTuples(dateTuples);

        luxons.forEach((luxon, index) => {
            expect(luxon.constructor.name).toBe('DateTime');
            expect(luxon.toString()).toEqual(mocks.parsedLuxonList[index]);
        });
    });
});

describe('setLastStatementDate', () => {
    const todaysDate = DateTime.local();
    const dateTuples = generateDateTuples({
        rawTextList: mocks.rawTextList,
        site: mocks.generateDateTuplesSite,
    });
    const luxons = parseLuxonsFromTuples(dateTuples);
    luxons.push(todaysDate);

    test('should return true if successful and call fs.writeFileSync with the appropriate arguments', () => {
        const writeFileSyncSpy = jest
            .spyOn(fs, 'writeFileSync')
            .mockImplementationOnce(() => {});
        jest.resetModules();
        const { setLastStatementDate } = require('./site-utils');

        const lastDateSetSuccessfully = setLastStatementDate({
            site: mocks.mockSite,
            luxons,
        });
        expect(lastDateSetSuccessfully).toBeTruthy();

        let modifiedMockSiteJSON = _.cloneDeep(mocks.mockSiteJSON);
        modifiedMockSiteJSON.latestDate = todaysDate.toISODate();
        expect(writeFileSyncSpy).toHaveBeenCalledWith(
            mockSitePath,
            JSON.stringify(modifiedMockSiteJSON),
        );
    });

    test('should return false if it encounters an error', () => {
        jest.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
            throw new Error('TEST ERROR - IGNORE');
        });
        jest.resetModules();
        const { setLastStatementDate } = require('./site-utils');

        const lastDateSetSuccessfully = setLastStatementDate({
            site: mocks.mockSite,
            luxons,
        });
        expect(lastDateSetSuccessfully).toBeFalsy();
    });
});

describe('splitMultiAccountSite', () => {
    test('should return the same site encapsulated in an array if given a single-account site', () => {
        expect(splitMultiAccountSite(mocks.singleAccountSite)).toEqual([
            mocks.singleAccountSite,
        ]);
    });

    test('should return an array in which each element has a unique statements object but shares all other data', () => {
        expect(splitMultiAccountSite(mocks.multiAccountSite)).toEqual(
            mocks.multiAccountSiteSplit,
        );
    });
});

describe('transferStatements', () => {
    const firstFile = 'first.json';
    const secondFile = 'second.json';
    const luxonNow = DateTime.local();
    const luxonFile = `${luxonNow.toISODate()}.json`;

    const testInputPath = path.join(
        config.pipelinePath,
        config.relativePaths.testInput,
        joinSiteIDAndAccount(mocks.mockSite, ' '),
    );
    fs.mkdirSync(testInputPath, { recursive: true });
    const firstInputPath = path.join(testInputPath, firstFile);
    const secondInputPath = path.join(testInputPath, secondFile);
    const luxonInputPath = path.join(testInputPath, luxonFile);
    fs.writeFileSync(firstInputPath, JSON.stringify({}));
    fs.writeFileSync(secondInputPath, JSON.stringify({}));
    fs.writeFileSync(luxonInputPath, JSON.stringify({}));

    const testOutputPath = path.join(
        config.pipelinePath,
        config.relativePaths.testOutput,
        mocks.mockSiteJSON.type,
        joinSiteIDAndAccount(mocks.mockSite, ' '),
    );
    const firstOutputPath = path.join(testOutputPath, firstFile);
    const secondOutputPath = path.join(testOutputPath, secondFile);
    const luxonOutputPath = path.join(testOutputPath, luxonFile);

    test('should return true if successfully transfers statements and deletes source directory', () => {
        const statementsTransferredSuccessfully = transferStatements({
            site: mocks.mockSite,
            downloadPath: testInputPath,
        });
        expect(statementsTransferredSuccessfully).toBeTruthy();

        [firstInputPath, secondInputPath, luxonInputPath].map((inputPath) =>
            expect(fs.existsSync(inputPath)).toBeFalsy(),
        );
        [firstOutputPath, secondOutputPath, luxonOutputPath].map((outputPath) =>
            expect(fs.existsSync(outputPath)).toBeTruthy(),
        );
        expect(fs.existsSync(testInputPath)).toBeFalsy();
    });

    test('should return false if it encounters an error', () => {
        jest.spyOn(fs, 'readdirSync').mockImplementationOnce(() => {
            throw new Error('TEST ERROR - IGNORE');
        });
        jest.resetModules();
        const { transferStatements } = require('./site-utils');

        const statementsTransferredSuccessfully = transferStatements({
            site: mocks.mockSite,
            downloadPath: testInputPath,
        });
        expect(statementsTransferredSuccessfully).toBeFalsy();
    });
});

describe('waitForChecksum', () => {
    const testOutputPath = path.join(
        config.pipelinePath,
        config.relativePaths.testOutput,
        'checkSumOutput',
    );
    const firstFile = '1995-01-01';
    const secondFile = '2000-01-01';
    const thirdFile = '2007-01-01';

    const dateTuples = [
        { rawText: firstFile, parsedLuxon: DateTime.fromISO(firstFile) },
        { rawText: secondFile, parsedLuxon: DateTime.fromISO(secondFile) },
        { rawText: thirdFile, parsedLuxon: DateTime.fromISO(thirdFile) },
    ];

    beforeEach(() => {
        jest.useFakeTimers();
        fs.mkdirSync(testOutputPath, { recursive: true });
        fs.writeFileSync(
            path.join(testOutputPath, `${firstFile}.json`),
            JSON.stringify({}),
        );
        fs.writeFileSync(
            path.join(testOutputPath, `${secondFile}.json`),
            JSON.stringify({}),
        );
        fs.writeFileSync(
            path.join(testOutputPath, `${thirdFile}.json`),
            JSON.stringify({}),
        );
    });

    afterEach(() => {
        jest.useRealTimers();
        fs.readdirSync(testOutputPath).map((file) =>
            fs.unlinkSync(path.join(testOutputPath, file)),
        );
    });

    test('should log all statements downloaded if there is the expected number of files', async () => {
        loggerInfoSpy.mockClear();

        await waitForChecksum({
            site: mocks.mockSite,
            dateTuples,
            downloadPath: testOutputPath,
        });

        const expectedString = `${mocks.mockSite.id}: All [${dateTuples.length}] statement(s) downloaded`;
        expect(loggerInfoSpy).toHaveBeenCalledWith(
            expect.stringContaining(expectedString),
        );
    });

    test('should warn if there is a mismatch in number of files and suggest potential duplicates', async () => {
        loggerInfoSpy.mockClear();

        const duplicateTuple = {
            rawText: thirdFile,
            parsedLuxon: DateTime.fromISO(thirdFile),
        };
        dateTuples.push(duplicateTuple);

        // Missing file is pushed after waitForChecksum iterates once
        setTimeout(() => {
            const missingFile = 'missingFile.json';
            fs.writeFileSync(
                path.join(testOutputPath, missingFile),
                JSON.stringify({}),
            );
        }, 2000);
        waitForChecksum({
            site: mocks.mockSite,
            dateTuples,
            downloadPath: testOutputPath,
        });

        const warningString = `${mocks.mockSite.id}: Expected [${
            dateTuples.length
        }] statement(s) but downloaded [${
            dateTuples.length - 1
        }] statement(s) instead - waiting for user to address`;
        const duplicatesString = `${
            mocks.mockSite.id
        }: Potential duplicate(s): [${JSON.stringify(duplicateTuple)}]`;
        expect(loggerInfoSpy).toHaveBeenCalledWith(
            expect.stringContaining(warningString),
        );
        expect(loggerInfoSpy).toHaveBeenCalledWith(
            expect.stringContaining(duplicatesString),
        );

        jest.runAllTimers();
    });
});

describe('waitForLoad', () => {
    const resolveMessage = 'resolveMessage';
    const resolvePage = {
        waitForNavigation: async () => {
            return new Promise((resolve) => {
                setTimeout(resolve, 2000, resolveMessage);
            });
        },
    };
    const fastTimeout = 1000;
    const slowTimeout = 3000;
    const resolvedWon = `networkPromise resolved: ${resolveMessage}`;
    const timeoutWon = 'Timeout Reached';

    const cases = [
        [resolvedWon, 'network calls resolve', resolvePage, slowTimeout],
        [timeoutWon, 'timeout resolves', resolvePage, fastTimeout],
    ];

    test.each(cases)(
        'should return "%s" if %s first',
        async (expectedMessage, _case, page, timeout) => {
            const results = await waitForLoad({
                page,
                site: mocks.mockSite,
                requestCount: 2,
                timeout,
            });
            expect(results).toEqual(expectedMessage);
        },
    );
});
