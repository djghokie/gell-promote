/**
 * Argument rules for the 'boolean' param type (TYPE format: gell-dispatch/rules/type)
 *  - no rules beyond the type
 *
 * NOTE: 'true' and 'false' count as booleans: snapshot (api) arguments arrive as query string values on a GET. The
 * handler still receives the argument as sent ('false' is truthy, so a handler reading a GET argument converts it)
 *
 * NOTE: a blank optional argument ('' or null) passes (allowBlank)
 */

/**
 * An argument as a boolean ('true' and 'false' convert; anything else is left as sent)
 */
function coerce(val) {
    if (val === 'true') return true;
    if (val === 'false') return false;

    return val;
}

module.exports = {
    name: 'boolean',
    allowBlank: true,
    rules: {
        isBoolean: {
            test: val => typeof val === 'boolean',
            message: () => 'must be true or false',
        },
    },
    default: ['isBoolean'],
    coerce,
};
