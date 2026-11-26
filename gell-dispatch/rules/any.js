/**
 * Argument rules for the 'any' param type (TYPE format: gell-dispatch/rules/type)
 *  - no rules: any value passes (a required argument is still checked for being present, by the caller of argument)
 */
module.exports = {
    name: 'any',
    rules: {},
    default: [],
};
