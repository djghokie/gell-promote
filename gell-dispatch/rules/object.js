const _ = require('lodash');

/**
 * Argument rules for the 'object' param type (see gell-dispatch/middleware/arguments TYPE_RULES)
 *  - requiredKeys: keys a (plain) object argument must have, e.g. ['city']
 *
 * NOTE: lenient, to match how 'object' params are used today
 *  - an array passes (e.g. TASKLIST items is declared 'object')
 *  - a string passes when it parses as a JSON object or array (e.g. gell.domain.query.run's args on a GET); the
 *    handler still receives the string and parses it
 *
 * NOTE: a blank optional argument ('' or null) passes; a blank required one is reported as required before the
 * type's rules run
 */

/**
 * An argument as an object or array (undefined when it is neither, nor a JSON string of one)
 */
function toObject(val) {
    if (_.isPlainObject(val) || Array.isArray(val)) return val;

    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);

            if (_.isPlainObject(parsed) || Array.isArray(parsed)) return parsed;
        } catch {
            // NOTE: not JSON, reported as not an object
        }
    }
}

/**
 * Rules in the order they are checked (the first failure is reported): [rule, check, message]
 *  - NOTE: requiredKeys applies to plain objects only; an array argument has no keys to check
 */
const RULES = [
    ['requiredKeys', (obj, keys) => Array.isArray(obj) || missingKeys(obj, keys).length === 0, (name, keys, obj) => `${name} must have ${missingKeys(obj, keys).join(', ')}`],
];

function missingKeys(obj, keys) {
    return keys.filter(key => obj[key] === undefined || obj[key] === null || obj[key] === '');
}

/**
 * Checks a (provided) object argument: its type, then the rules it declares
 *
 * @param {*} name the param's name (messages name it)
 * @param {*} val the argument
 * @param {*} rules the param's validate rules ({ requiredKeys, ... })
 * @returns the first failure ({ rule, message }), or undefined when the argument passes
 */
function check(name, val, rules={}) {
    if (val === '' || val === null) return;

    const obj = toObject(val);

    if (obj === undefined) return { rule: 'type', message: `${name} must be an object` };

    for (const [rule, test, message] of RULES) {
        if (rules[rule] !== undefined && !test(obj, rules[rule])) return { rule, message: message(name, rules[rule], obj) };
    }
}

module.exports = {
    RULES,
    toObject,
    check,
};
