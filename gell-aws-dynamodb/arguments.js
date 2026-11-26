const assert = require('assert');

const { compileParams } = require('../gell-event/binding/compiler');
const { TYPES } = require('../gell-dispatch/rules/type');
const { object } = require('../gell-dispatch/validate');

/**
 * Arguments of named queries and operations, checked like params (see gell-dispatch/validate object)
 *  - a definition's parameters declare each parameter as a param does: its type's name, or { type, optional, validate }
 *
 * NOTE: shared by query-wrapper and operation-wrapper
 */

/**
 * Asserts every parameter of a definition has a type defined in TYPES (gell-dispatch/rules/type), so a store with a
 * bad definition fails when it is built, not on the definition's first call
 *
 * @param {*} kind 'query' or 'operation' (names the definition in the message)
 * @param {*} name the definition's name
 * @param {*} def the definition ({ parameters, ... })
 */
function assertTypes(kind, name, def) {
    Object.values(compileParams(def.parameters)).forEach(({ name: parameter, type }) => {
        assert(TYPES[type], `${kind} parameter type is not defined (${kind}=${name}; parameter=${parameter}; type=${type})`);
    });
}

/**
 * A definition's arguments, validated and coerced
 *  - throws an Error (name ObjectValidationError) whose errors lists every failing parameter
 *
 * @param {*} def the definition ({ parameters, ... })
 * @param {*} args the arguments of the call
 * @returns a copy of args with the coerced value of each parameter provided
 */
function validateArgs(def, args={}) {
    return object(args, compileParams(def.parameters));
}

module.exports = {
    assertTypes,
    validateArgs,
};
