/**
 * Argument rules for the 'number' param type (see gell-dispatch/middleware/arguments TYPE_RULES)
 *  - min/max: inclusive bounds
 *  - enum: the allowed values, compared as numbers (so '2', a GET argument, matches 2)
 *
 * NOTE: a numeric string ('12', '1.5') counts as a number: snapshot (api) arguments arrive as query string values
 * on a GET, so every value is a string. The handler still receives the argument as sent; it converts it
 *
 * NOTE: a blank optional argument ('' or null, e.g. an empty form field) passes; a blank required one is reported
 * as required before the type's rules run
 */

/**
 * Rules in the order they are checked (the first failure is reported): [rule, check, message]
 */
const RULES = [
    ['min', (n, min) => n >= min, (name, min) => `${name} must be at least ${min}`],
    ['max', (n, max) => n <= max, (name, max) => `${name} must be at most ${max}`],
    ['enum', (n, values) => values.map(toNumber).includes(n), (name, values) => `${name} must be one of ${values.join(', ')}`],
];

/**
 * An argument as a number (NaN when it is not one)
 */
function toNumber(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.trim() !== '') return Number(val);

    return NaN;
}

/**
 * Checks a (provided) number argument: its type, then the rules it declares
 *
 * @param {*} name the param's name (messages name it)
 * @param {*} val the argument
 * @param {*} rules the param's validate rules ({ min, max, ... })
 * @returns the first failure ({ rule, message }), or undefined when the argument passes
 */
function check(name, val, rules={}) {
    if (val === '' || val === null) return;

    const n = toNumber(val);

    if (!Number.isFinite(n)) return { rule: 'type', message: `${name} must be a number` };

    for (const [rule, test, message] of RULES) {
        if (rules[rule] !== undefined && !test(n, rules[rule])) return { rule, message: message(name, rules[rule]) };
    }
}

module.exports = {
    RULES,
    toNumber,
    check,
};
