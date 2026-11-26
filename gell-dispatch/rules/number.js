/**
 * Argument rules for the 'number' param type (TYPE format: gell-dispatch/rules/type)
 *  - min/max: inclusive bounds
 *  - enum: the allowed values, compared as numbers (so '2', a GET argument, matches 2)
 *
 * NOTE: a numeric string ('12', '1.5') counts as a number: snapshot (api) arguments arrive as query string values
 * on a GET, so every value is a string. The handler still receives the argument as sent; it converts it
 *
 * NOTE: a blank optional argument ('' or null, e.g. an empty form field) passes (allowBlank)
 */

/**
 * An argument as a number (NaN when it is not one)
 */
function coerce(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.trim() !== '') return Number(val);

    return NaN;
}

module.exports = {
    name: 'number',
    allowBlank: true,
    rules: {
        isNumber: {
            default: true,
            test: n => Number.isFinite(n),
            message: () => 'must be a number',
        },
        min: {
            type: 'number',
            test: (n, min) => n >= min,
            message: (n, min) => `must be at least ${min}`,
        },
        max: {
            type: 'number',
            test: (n, max) => n <= max,
            message: (n, max) => `must be at most ${max}`,
        },
        enum: {
            type: ['number'],
            test: (n, values) => values.includes(n),
            message: (n, values) => `must be one of ${values.join(', ')}`,
        },
    },
    default: ['isNumber'],
    coerce,
};
