const number = require('./number');

/**
 * Argument rules for the 'timestamp' param type (TYPE format: gell-dispatch/rules/type)
 *  - min/max: inclusive bounds, as epoch milliseconds or a date string (e.g. '2026-01-01')
 *
 * NOTE: a timestamp argument is epoch milliseconds, a numeric string (a GET argument), or a date string that
 * Date parses (e.g. ISO 8601); the handler still receives the argument as sent and converts it
 *
 * NOTE: a blank optional argument ('' or null) passes (allowBlank)
 */

/**
 * A timestamp argument (or rule bound) as epoch milliseconds (NaN when it is not a date)
 *  - numbers and numeric strings are epoch milliseconds; other strings are parsed as dates
 */
function coerce(val) {
    const n = number.coerce(val);

    if (Number.isFinite(n)) return n;
    if (typeof val === 'string') return new Date(val).getTime();

    return NaN;
}

function formatTs(bound) {
    return new Date(coerce(bound)).toISOString();
}

module.exports = {
    name: 'timestamp',
    allowBlank: true,
    rules: {
        isTimestamp: {
            default: true,
            test: ts => Number.isFinite(ts),
            message: () => 'is not a valid date',
        },
        min: {
            type: 'timestamp',
            test: (ts, min) => ts >= coerce(min),
            message: (ts, min) => `must be on or after ${formatTs(min)}`,
        },
        max: {
            type: 'timestamp',
            test: (ts, max) => ts <= coerce(max),
            message: (ts, max) => `must be on or before ${formatTs(max)}`,
        },
    },
    default: ['isTimestamp'],
    coerce,
};
