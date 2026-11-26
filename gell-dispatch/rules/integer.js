/**
 * Argument rules for the 'integer' param type (TYPE format: gell-dispatch/rules/type); extends number
 *  - number's rules (min, max, enum), allowBlank and coerce (so '12', a GET argument, counts)
 *  - positive: true requires at least 1 (built on number's min)
 */
module.exports = {
    name: 'integer',
    extends: 'number',
    rules: {
        isInteger: {
            test: n => Number.isInteger(n),
            message: () => 'must be an integer',
        },
        positive: {
            type: 'boolean',
            test: (n, apply, inherited) => !apply || inherited.min.test(n, 1),
            message: () => 'must be a positive number',
        },
    },
    default: ['isInteger'],
};
