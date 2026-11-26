/**
 * Argument rules for the 'array' param type (TYPE format: gell-dispatch/rules/type)
 *  - minItems/maxItems: number of items
 *
 * NOTE: items (the spec of each item, like a param's) is not one of the type's rules: gell-dispatch/middleware/arguments
 * checks each item like a param named name[index], after these rules
 *
 * NOTE: strict (no coerce): only an array passes (a JSON string does not); a param that must also accept a JSON
 * string (e.g. a GET argument) declares 'object', which accepts arrays
 *
 * NOTE: a blank optional argument ('' or null) passes (allowBlank)
 */
module.exports = {
    name: 'array',
    allowBlank: true,
    rules: {
        isArray: {
            default: true,
            test: val => Array.isArray(val),
            message: () => 'must be an array',
        },
        minItems: {
            type: 'number',
            test: (val, min) => val.length >= min,
            message: (val, min) => min === 1 ? 'cannot be empty' : `must have at least ${min} items`,
        },
        maxItems: {
            type: 'number',
            test: (val, max) => val.length <= max,
            message: (val, max) => `must have at most ${max} items`,
        },
    },
    default: ['isArray'],
};
