const assert = require('assert');

const { compileParams } = require('../gell-event/binding/compiler');
const { TYPES } = require('../gell-dispatch/rules/type');
const { object } = require('../gell-dispatch/validate');

/**
 * Runs named query and operation definitions (see gell-aws-dynamodb docs/named.md), checking their arguments like
 * params (gell-dispatch/validate object): the store's query and write modules call these, so a store holds the
 * definitions as registered
 *
 * a named query: { name, description, parameters, query, filter }
 *  - query: the DynamoDB (dynamodb-toolbox) query, or a function of the args that returns it
 *  - filter: (items, args) => the matching items, for the in-memory (mock) store
 *
 * a named operation: { name, description, parameters, operation, modify }
 *  - operation: the DynamoDB command, or a function of the request that returns it
 *  - modify: (item$, request) => the modified item, for the in-memory (mock) store
 *
 * parameters declare each parameter as a param does: its type's name, or { type, optional, validate }
 *  - every parameter type must be defined (gell-dispatch/rules/type TYPES): configure fails an assert otherwise
 *  - each call's args are validated and coerced first (an Error named ObjectValidationError lists every failing
 *    parameter), and the definition gets the coerced args
 *  - a definition that is a function is called as it is (no parameters to check)
 *
 * NOTE: a named operation's args are its request ({ name, key, values, ...args }); the definition gets the request
 * with its parameters coerced
 */

/**
 * Adds named query or operation definitions to a store's map, as they are
 *  - asserts the parameter types of each definition (a store with a bad definition fails when it is built)
 *
 * @param {*} kind 'query' or 'operation'
 * @param {*} target the store's map of definitions by name (namedQueries, namedOperations)
 * @param  {...any} defs maps of definitions by name (e.g. a query module, or a registry's definitions())
 */
function configure(kind, target, ...defs) {
    defs.forEach(byName => Object.entries(byName).forEach(([name, def]) => {
        if (typeof def !== 'function') assertTypes(kind, name, def);

        target[name] = def;
    }));
}

/**
 * Asserts every parameter of a definition has a type defined in TYPES (gell-dispatch/rules/type)
 */
function assertTypes(kind, name, def) {
    Object.values(compileParams(def.parameters)).forEach(({ name: parameter, type }) => {
        assert(TYPES[type], `${kind} parameter type is not defined (${kind}=${name}; parameter=${parameter}; type=${type})`);
    });
}

/**
 * A definition's args, validated and coerced
 */
function validateArgs(def, args={}) {
    return object(args, compileParams(def.parameters));
}

/**
 * The DynamoDB query of a named query
 */
function query(name, def, args) {
    if (typeof def === 'function') return def(args);

    assert(def.query, `named query (name=${name}) does not define a DynamoDB implementation`);

    const coerced = validateArgs(def, args);

    return typeof def.query === 'function' ? def.query(coerced) : def.query;
}

/**
 * The items of a named query, from the in-memory (mock) store's items
 */
function filter(name, def, items, args) {
    if (typeof def === 'function') return def(items, args);

    assert(def.filter, `named query (name=${name}) does not define a filter`);

    return def.filter(items, validateArgs(def, args));
}

/**
 * The DynamoDB command of a named operation
 */
function operation(name, def, request) {
    if (typeof def === 'function') return def(request);

    assert(def.operation, `named operation (name=${name}) does not define a DynamoDB implementation`);

    const coerced = validateArgs(def, request);

    return typeof def.operation === 'function' ? def.operation(coerced) : def.operation;
}

/**
 * The item a named operation modifies, in the in-memory (mock) store
 */
function modify(name, def, item$, request) {
    if (typeof def === 'function') return def(item$, request);

    assert(def.modify, `named operation (name=${name}) does not define modify`);

    return def.modify(item$, validateArgs(def, request));
}

module.exports = {
    configure,
    assertTypes,
    query,
    filter,
    operation,
    modify,
};
