const { toNumber } = require('./number');

/**
 * Argument rules for the 'timestamp' param type (see gell-dispatch/middleware/arguments TYPE_RULES)
 *  - min/max: inclusive bounds, as epoch milliseconds or a date string (e.g. '2026-01-01')
 *
 * NOTE: a timestamp argument is epoch milliseconds, a numeric string (a GET argument), or a date string that
 * Date parses (e.g. ISO 8601); the handler still receives the argument as sent and converts it
 *
 * NOTE: a blank optional argument ('' or null) passes; a blank required one is reported as required before the
 * type's rules run
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

/**
 * Rules in the order they are checked (the first failure is reported): [rule, check, message]
 */
const RULES = [
    ['min', (ts, min) => ts >= toTs(min), (name, min) => `${name} must be on or after ${formatTs(min)}`],
    ['max', (ts, max) => ts <= toTs(max), (name, max) => `${name} must be on or before ${formatTs(max)}`],
];

/**
 * Checks a (provided) timestamp argument: its type, then the rules it declares
 *
 * @param {*} name the param's name (messages name it)
 * @param {*} val the argument
 * @param {*} rules the param's validate rules ({ min, max, ... })
 * @returns the first failure ({ rule, message }), or undefined when the argument passes
 */
function check(name, val, rules={}) {
    if (val === '' || val === null) return;

    const ts = toTs(val);

    if (!Number.isFinite(ts)) return { rule: 'type', message: `${name} is not a valid date (${name}=${val})` };

    for (const [rule, test, message] of RULES) {
        if (rules[rule] !== undefined && !test(ts, rules[rule])) return { rule, message: message(name, rules[rule]) };
    }
}

module.exports = {
    RULES,
    toTs,
    check,
};
