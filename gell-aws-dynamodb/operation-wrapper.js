const assert = require('assert');

const { assertTypes, validateArgs } = require('./arguments');

/**
 * Wraps named operation definitions for a store's namedOperations: each call's arguments are validated and coerced
 * against the definition's parameters (gell-dispatch rules) before the operation runs
 *  - dynamodb: name => args => the DynamoDB operation, from the definition's operation
 *  - ut: name => (item$, args) => the modified item, from the definition's modify (the in-memory store)
 *
 * a definition: { name, description, parameters, operation, modify }
 *  - operation: the DynamoDB operation, or a function of the (coerced) args that returns it
 *  - a definition that is a function is registered as it is (no parameters to check)
 *  - every parameter type must be defined (gell-dispatch/rules/type TYPES): wrapping fails an assert otherwise
 *
 * NOTE: replaces the gell-aws-dynamodb package's operation-wrapper (which only asserted required parameters), with
 * the same exports
 */

exports.dynamodb = operations => {
    const wrapped = {};

    Object.keys(operations).forEach(name => {
        const def = operations[name];

        if (typeof def === 'function') {
            wrapped[name] = def;
            return;
        }

        assertTypes('operation', name, def);

        wrapped[name] = args => {
            const { operation } = def;

            assert(operation, `named operation (name=${def.name}) does not define a DynamoDB implementation`);

            const coerced = validateArgs(def, args);

            if (typeof operation === 'function') return operation(coerced);

            return operation;
        }
    })

    return wrapped;
}

exports.ut = operations => {
    const wrapped = {};

    Object.keys(operations).forEach(name => {
        const def = operations[name];

        if (typeof def === 'function') {
            wrapped[name] = def;
            return;
        }

        assertTypes('operation', name, def);

        wrapped[name] = (item$, args) => def.modify(item$, validateArgs(def, args));
    })

    return wrapped;
}
