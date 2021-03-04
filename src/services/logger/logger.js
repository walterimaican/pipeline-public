const winston = require('winston');
const { DateTime } = require('luxon');

const { getConfig } = require('../config-utils/config-utils');

const config = getConfig();
const SPLAT = Symbol.for('splat');

const customFormat = winston.format.combine(
    winston.format.splat(),
    winston.format.printf((info) => {
        let timestamp,
            level,
            message,
            rest,
            meta = '';
        ({ timestamp, level, message, ...rest } = info);

        if (rest && rest[SPLAT]) {
            meta = rest[SPLAT][0]
                ? JSON.stringify(rest[SPLAT][0])
                : rest[SPLAT][0];
        }

        return `${timestamp ? timestamp + ' ' : ''}${level}: ${message}${meta}`;
    }),
);

const transportsArray = [
    new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), customFormat),
    }),
];

if (process.env.NODE_ENV === 'prod') {
    const logDirectory = config.relativePaths.logs;
    const runNumber = process.env.RUN_NUMBER;
    const logTimestamp = DateTime.local().toISODate();
    const logName = `${logDirectory}/Log_${runNumber}_Ran_${logTimestamp}.log`;

    transportsArray.push(
        new winston.transports.File({
            filename: logName,
            format: winston.format.combine(
                winston.format.timestamp(),
                customFormat,
            ),
        }),
    );
}

const logger = winston.createLogger({ transports: transportsArray });
module.exports = logger;
