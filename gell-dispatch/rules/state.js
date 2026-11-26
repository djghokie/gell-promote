/**
 * Argument rules for the 'state' param type (TYPE format: gell-dispatch/rules/type)
 *  - isState: a materialized gell entity (a State: has snapshot(), see the name_ naming convention)
 *
 * WIP: duck typed on snapshot; check for gell-state's State once it can be required here (it is ESM only)
 */
module.exports = {
    name: 'state',
    rules: {
        isState: {
            test: val => !!val && typeof val.snapshot === 'function',
            message: () => 'must be a gell entity (State)',
        },
    },
    default: ['isState'],
};
