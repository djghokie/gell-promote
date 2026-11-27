const assert = require('assert');

const { compileParams } = require('../gell-event/binding/compiler');
const { object } = require('../gell-dispatch/validate');

/**
 * Runs named query and operation definitions (see gell-aws-dynamodb docs/named.md), checking their arguments like
 * params (gell-dispatch/validate object): the store's query and write modules call these with the definitions they
 * get from the store's registries (store.queries, store.operations; gell-discover Queries / Operations)
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
 *  - every parameter type must be defined (gell-dispatch/rules/type TYPES): the registries (gell-discover Queries /
 *    Operations) fail an assert when a definition is registered otherwise
 *  - each call's args are validated and coerced first (an Error named ObjectValidationError lists every failing
 *    parameter), and the definition gets the coerced args
 *
 * NOTE: a named operation's args are its request ({ name, key, values, ...args }); the definition gets the request
 * with its parameters coerced
 */

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
    assert(def.query, `named query (name=${name}) does not define a DynamoDB implementation`);

    const coerced = validateArgs(def, args);

    return typeof def.query === 'function' ? def.query(coerced) : def.query;
}

/**
 * The items of a named query, from the in-memory (mock) store's items
 */
function filter(name, def, items, args) {
    assert(def.filter, `named query (name=${name}) does not define a filter`);

    return def.filter(items, validateArgs(def, args));
}

/**
 * The DynamoDB command of a named operation
 */
function operation(name, def, request) {
    assert(def.operation, `named operation (name=${name}) does not define a DynamoDB implementation`);

    const coerced = validateArgs(def, request);

    return typeof def.operation === 'function' ? def.operation(coerced) : def.operation;
}

/**
 * The item a named operation modifies, in the in-memory (mock) store
 */
function modify(name, def, item$, request) {
    assert(def.modify, `named operation (name=${name}) does not define modify`);

    return def.modify(item$, validateArgs(def, request));
}

module.exports = {
    query,
    filter,
    operation,
    modify,
};
