const _ = require('lodash');

/**
 * Argument rules for the 'string' param type (TYPE format: gell-dispatch/rules/type)
 *  - minLength/maxLength: number of characters
 *  - pattern: a regular expression source string (not a RegExp); it is not anchored, so use ^ and $ to match the
 *    whole value
 *  - enum: the allowed values
 *
 * NOTE: pattern is a string because a RegExp does not survive JSON, so the action page could not show it
 *
 * NOTE: blanks are not allowed: an optional '' still has to pass the rules it declares (e.g. an enum)
 */
module.exports = {
    name: 'string',
    rules: {
        isString: {
            default: true,
            test: val => _.isString(val),
            message: () => 'must be a string',
        },
        minLength: {
            type: 'number',
            test: (val, min) => val.length >= min,
            message: (val, min) => min === 1 ? 'cannot be empty' : `must be at least ${min} characters`,
        },
        maxLength: {
            type: 'number',
            test: (val, max) => val.length <= max,
            message: (val, max) => `must be at most ${max} characters`,
        },
        pattern: {
            type: 'string',
            test: (val, pattern) => new RegExp(pattern).test(val),
            message: (val, pattern) => `must match ${pattern}`,
        },
        enum: {
            type: 'array',
            test: (val, values) => values.includes(val),
            message: (val, values) => `must be one of ${values.join(', ')}`,
        },
    },
    default: ['isString'],
};
