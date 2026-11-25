/**
 * Argument rules for the 'array' param type (see gell-dispatch/middleware/arguments TYPE_RULES)
 *  - minItems/maxItems: number of items
 *
 * NOTE: strict: only an array passes (a JSON string does not); a param that must also accept a JSON string (e.g. a
 * GET argument) declares 'object', which accepts arrays
 *
 * NOTE: a blank optional argument ('' or null) passes; a blank required one is reported as required before the
 * type's rules run
 */

/**
 * Rules in the order they are checked (the first failure is reported): [rule, check, message]
 */
const RULES = [
    ['minItems', (items, min) => items.length >= min, (name, min) => min === 1 ? `${name} cannot be empty` : `${name} must have at least ${min} items`],
    ['maxItems', (items, max) => items.length <= max, (name, max) => `${name} must have at most ${max} items`],
];

/**
 * Checks a (provided) array argument: its type, then the rules it declares
 *
 * @param {*} name the param's name (messages name it)
 * @param {*} val the argument
 * @param {*} rules the param's validate rules ({ minItems, maxItems, ... })
 * @returns the first failure ({ rule, message }), or undefined when the argument passes
 */
function check(name, val, rules={}) {
    if (val === '' || val === null) return;

    if (!Array.isArray(val)) return { rule: 'type', message: `${name} must be an array` };

    for (const [rule, test, message] of RULES) {
        if (rules[rule] !== undefined && !test(val, rules[rule])) return { rule, message: message(name, rules[rule]) };
    }
}

module.exports = {
    RULES,
    check,
};
