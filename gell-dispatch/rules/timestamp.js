const { isBlank } = require('./type');
const { toNumber } = require('./number');

/**
 * Argument rules for the 'timestamp' param type (TYPE format: gell-dispatch/rules/type)
 *  - min/max: inclusive bounds, as epoch milliseconds or a date string (e.g. '2026-01-01')
 *
 * NOTE: a timestamp argument is epoch milliseconds, a numeric string (a GET argument), or a date string that
 * Date parses (e.g. ISO 8601); the handler still receives the argument as sent and converts it
 *
 * NOTE: a blank optional argument ('' or null) passes (skip)
 */

/**
 * A timestamp argument (or rule bound) as epoch milliseconds (NaN when it is not a date)
 *  - numbers and numeric strings are epoch milliseconds; other strings are parsed as dates
 */
function toTs(val) {
    const n = toNumber(val);

    if (Number.isFinite(n)) return n;
    if (typeof val === 'string') return new Date(val).getTime();

    return NaN;
}

function formatTs(bound) {
    return new Date(toTs(bound)).toISOString();
}

const TYPE = {
    name: 'timestamp',
    rules: {
        isTimestamp: {
            default: true,
            test: val => Number.isFinite(toTs(val)),
            message: val => `is not a valid date (value=${val})`,
        },
        min: {
            type: 'timestamp',
            test: (val, min) => toTs(val) >= toTs(min),
            message: (val, min) => `must be on or after ${formatTs(min)}`,
        },
        max: {
            type: 'timestamp',
            test: (val, max) => toTs(val) <= toTs(max),
            message: (val, max) => `must be on or before ${formatTs(max)}`,
        },
    },
    default: ['isTimestamp'],
    skip: isBlank,
};

module.exports = {
    TYPE,
    toTs,
};
