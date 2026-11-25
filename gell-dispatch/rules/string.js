const _ = require('lodash');

/**
 * Argument rules for the 'string' param type (see gell-dispatch/middleware/arguments TYPE_RULES)
 *  - minLength/maxLength: number of characters
 *  - pattern: a regular expression source string (or RegExp); it is not anchored, so use ^ and $ to match the whole
 *    value
 *  - enum: the allowed values
 *
 * NOTE: declare pattern as a string: a RegExp does not survive JSON, so the action page could not show it
 */

/**
 * Rules in the order they are checked (the first failure is reported): [rule, check, message]
 */
const RULES = [
    ['minLength', (val, min) => val.length >= min, (name, min) => min === 1 ? `${name} cannot be empty` : `${name} must be at least ${min} characters`],
    ['maxLength', (val, max) => val.length <= max, (name, max) => `${name} must be at most ${max} characters`],
    ['pattern', (val, pattern) => new RegExp(pattern).test(val), (name, pattern) => `${name} must match ${pattern}`],
    ['enum', (val, values) => values.includes(val), (name, values) => `${name} must be one of ${values.join(', ')}`],
];

/**
 * Checks a (provided) string argument: its type, then the rules it declares
 *
 * @param {*} name the param's name (messages name it)
 * @param {*} val the argument
 * @param {*} rules the param's validate rules ({ minLength, maxLength, pattern, ... })
 * @returns the first failure ({ rule, message }), or undefined when the argument passes
 */
function check(name, val, rules={}) {
    if (!_.isString(val)) return { rule: 'type', message: `${name} must be a string` };

    for (const [rule, test, message] of RULES) {
        if (rules[rule] !== undefined && !test(val, rules[rule])) return { rule, message: message(name, rules[rule]) };
    }
}

module.exports = {
    RULES,
    check,
};
