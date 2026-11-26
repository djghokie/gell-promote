const { isBlank } = require('./type');

/**
 * Argument rules for the 'boolean' param type (TYPE format: gell-dispatch/rules/type)
 *  - no rules beyond the type
 *
 * NOTE: 'true' and 'false' count as booleans: snapshot (api) arguments arrive as query string values on a GET. The
 * handler still receives the argument as sent ('false' is truthy, so a handler reading a GET argument converts it)
 *
 * NOTE: a blank optional argument ('' or null) passes (skip)
 */

const STRINGS = ['true', 'false'];

const TYPE = {
    name: 'boolean',
    rules: {
        isBoolean: {
            default: true,
            test: val => typeof val === 'boolean' || STRINGS.includes(val),
            message: () => 'must be true or false',
        },
    },
    default: ['isBoolean'],
    skip: isBlank,
};

module.exports = {
    TYPE,
};
