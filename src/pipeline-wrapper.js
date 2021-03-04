/**
 * A wrapper process for the main process.
 *
 * The main process saves all of its logs to the logs/* directory.
 * However, they cannot be committed and pushed while the main process is running.
 * This wrapper process kicks off the main process and listens to it.
 * When complete, the logs are committed and pushed.
 */

const fs = require('fs');
const path = require('path');
const { start } = require('observable-process');

const { execWrapper, generatePushCommand } = require('./services/utils/utils');
const { getConfig } = require('./services/config-utils/config-utils');

const config = getConfig();
const runNumberPath = path.join(
    config.pipelinePath,
    config.relativePaths.runNumberJSON,
);
const runNumberJSON = require(runNumberPath);
const runNumber = runNumberJSON.runNumber;
const env = process.env.NODE_ENV || 'prod';

(async () => {
    try {
        const pipelineJsPath = path.join(
            config.pipelinePath,
            config.relativePaths.pipelineJS,
        );
        const childPipeline = start(`node ${pipelineJsPath}`, {
            env: {
                NODE_ENV: env,
                RUN_NUMBER: runNumber,
            },
        });

        runNumberJSON.runNumber = runNumber + 1;
        fs.writeFileSync(runNumberPath, JSON.stringify(runNumberJSON));

        // Normal console passthrough from the main process.
        childPipeline.output.on('data', (data) => {
            console.log(data.toString());
        });

        // Upon completion, commit and push logs.
        await childPipeline.waitForEnd().then(async (result) => {
            console.log('====================================');
            console.log(
                `MAIN PROCESS ENDED WITH EXIT CODE: ${result.exitCode}`,
            );
            console.log(`MAIN PROCESS WAS KILLED: ${result.killed}`);
            console.log('ATTEMPTING TO COMMIT AND PUSH LOGS.');

            const pushLogsCommand = generatePushCommand(runNumber, 'logs');
            const scriptStatus = await execWrapper(pushLogsCommand, false);
            if (!scriptStatus) throw new Error('Failed to push logs');
        });
    } catch (error) {
        console.log('PIPELINE WRAPPER ERROR CAUGHT: ', error);
        console.log('Pipeline ended prematurely... Exiting.');
    }
})();
