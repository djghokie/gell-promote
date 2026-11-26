const { isBlank } = require('./type');

/**
 * Argument rules for the 'number' param type (TYPE format: gell-dispatch/rules/type)
 *  - min/max: inclusive bounds
 *  - enum: the allowed values, compared as numbers (so '2', a GET argument, matches 2)
 *
 * NOTE: a numeric string ('12', '1.5') counts as a number: snapshot (api) arguments arrive as query string values
 * on a GET, so every value is a string. The handler still receives the argument as sent; it converts it
 *
 * NOTE: a blank optional argument ('' or null, e.g. an empty form field) passes (skip)
 */

/**
 * An argument as a number (NaN when it is not one)
 */
function toNumber(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.trim() !== '') return Number(val);

    return NaN;
}

const TYPE = {
    name: 'number',
    rules: {
        isNumber: {
            default: true,
            test: val => Number.isFinite(toNumber(val)),
            message: () => 'must be a number',
        },
        min: {
            type: 'number',
            test: (val, min) => toNumber(val) >= min,
            message: (val, min) => `must be at least ${min}`,
        },
        max: {
            type: 'number',
            test: (val, max) => toNumber(val) <= max,
            message: (val, max) => `must be at most ${max}`,
        },
        enum: {
            type: 'array',
            test: (val, values) => values.map(toNumber).includes(toNumber(val)),
            message: (val, values) => `must be one of ${values.join(', ')}`,
        },
    },
    default: ['isNumber'],
    skip: isBlank,
};

module.exports = {
    TYPE,
    toNumber,
};
