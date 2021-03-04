const mockConfig = {
    puppeteer: 'mockPuppeteer',
    externalPaths: {
        downloads: 'mockDownloads',
        desktop: 'mockDesktop',
    },
};
const mockSitesConfig = {
    finances: 'mockSitesConfigFinances',
    dev: 'mockSitesConfigDev',
};
const mockConfigUtil = {
    getConfig: () => mockConfig,
    getSitesConfig: () => mockSitesConfig,
};
const mockJsonData = { finances: 'mockFinances' };

const mockGetDataFromVolume = jest
    .fn()
    .mockReturnValue({ jsonData: mockJsonData });
const mockHandleMultipleFinanceSites = jest.fn();
const mockOpen = jest.fn();
const mockWaitForInput = jest.fn();

jest.doMock('open', () => mockOpen);
jest.doMock('../services/config-utils/config-utils', () => mockConfigUtil);
jest.doMock('../services/site-handling/site-handling', () => ({
    handleMultipleFinanceSites: mockHandleMultipleFinanceSites,
}));
jest.doMock('../services/utils/utils', () => ({
    waitForInput: mockWaitForInput,
}));
jest.doMock('../services/veracrypt/veracrypt', () => ({
    getDataFromVolume: mockGetDataFromVolume,
}));

const consoleSpy = jest.spyOn(console._stdout, 'write');

const defaultEnvironment = process.env;

describe('documentsPipeline', () => {
    beforeEach(() => {
        jest.resetModules();
        process.env = { ...defaultEnvironment };
    });

    test('should get credentials from volume', async () => {
        const documentsPipeline = require('./documents-pipeline');
        await documentsPipeline();
        expect(mockGetDataFromVolume).toHaveBeenCalledWith('credentials');
    });

    test('should handle finance sites if in prod', async () => {
        const documentsPipeline = require('./documents-pipeline');
        await documentsPipeline();

        const expectedArgs = {
            credentialsList: 'mockFinances',
            puppeteerPreferences: 'mockPuppeteer',
            sitesList: 'mockSitesConfigFinances',
        };
        expect(mockHandleMultipleFinanceSites).toHaveBeenCalledWith(
            expectedArgs,
        );
    });

    test('should handle finance sites if in dev', async () => {
        process.env.NODE_ENV = 'dev';
        const documentsPipeline = require('./documents-pipeline');
        await documentsPipeline();

        const expectedArgs = {
            credentialsList: 'mockFinances',
            puppeteerPreferences: 'mockPuppeteer',
            sitesList: 'mockSitesConfigDev',
        };
        expect(mockHandleMultipleFinanceSites).toHaveBeenCalledWith(
            expectedArgs,
        );
    });

    test('should inform user to manually handle certain items', async () => {
        const documentsPipeline = require('./documents-pipeline');
        await documentsPipeline();

        ['Downloads', 'Desktop', 'Laptop', 'Bookmarks', 'Emails'].forEach(
            (source) => {
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining(source),
                );
            },
        );

        [
            mockConfig.externalPaths.downloads,
            mockConfig.externalPaths.desktop,
            'https://www.google.com/',
        ].forEach((source) => {
            expect(mockOpen).toHaveBeenCalledWith(source);
        });
    });
});
