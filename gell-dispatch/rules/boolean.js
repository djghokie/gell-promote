/**
 * Argument rules for the 'boolean' param type (see gell-dispatch/middleware/arguments TYPE_RULES)
 *  - no rules beyond the type
 *
 * NOTE: 'true' and 'false' count as booleans: snapshot (api) arguments arrive as query string values on a GET. The
 * handler still receives the argument as sent ('false' is truthy, so a handler reading a GET argument converts it)
 *
 * NOTE: a blank optional argument ('' or null) passes; a blank required one is reported as required before the
 * type's rules run
 */

const RULES = [];

const STRINGS = ['true', 'false'];

/**
 * Checks a (provided) boolean argument
 *
 * @param {*} name the param's name (messages name it)
 * @param {*} val the argument
 * @returns the failure ({ rule, message }), or undefined when the argument passes
 */
function check(name, val) {
    if (val === '' || val === null) return;

    if (typeof val === 'boolean' || STRINGS.includes(val)) return;

    return { rule: 'type', message: `${name} must be true or false` };
}

module.exports = {
    RULES,
    check,
};
