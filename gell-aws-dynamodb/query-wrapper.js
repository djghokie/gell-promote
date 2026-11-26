const assert = require('assert');

const { assertTypes, validateArgs } = require('./arguments');

/**
 * Wraps named query definitions for a store's namedQueries: each call's arguments are validated and coerced against
 * the definition's parameters (gell-dispatch rules) before the query runs
 *  - dynamodb: name => args => the DynamoDB (dynamodb-toolbox) query, from the definition's query
 *  - ut: name => (items, args) => the matching items, from the definition's filter (the in-memory store)
 *
 * a definition: { name, description, parameters, query, filter }
 *  - query: the DynamoDB query, or a function of the (coerced) args that returns it
 *  - a definition that is a function is registered as it is (no parameters to check)
 *  - every parameter type must be defined (gell-dispatch/rules/type TYPES): wrapping fails an assert otherwise
 *
 * NOTE: replaces the gell-aws-dynamodb package's query-wrapper (which only asserted required parameters), with the
 * same exports
 */

exports.dynamodb = queries => {
    const wrapped = {};

    Object.keys(queries).forEach(name => {
        const def = queries[name];

        if (typeof def === 'function') {
            wrapped[name] = def;
            return;
        }

        assertTypes('query', name, def);

        wrapped[name] = args => {
            const { query } = def;

            assert(query, `named query (name=${def.name}) does not define a DynamoDB implementation`);

            const coerced = validateArgs(def, args);

            if (typeof query === 'function') return query(coerced);

            return query;
        }
    })

    return wrapped;
}

exports.ut = queries => {
    const wrapped = {};

    Object.keys(queries).forEach(name => {
        const def = queries[name];

        if (typeof def === 'function') {
            wrapped[name] = def;
            return;
        }

        assertTypes('query', name, def);

        wrapped[name] = (items, args) => def.filter(items, validateArgs(def, args));
    })

    return wrapped;
}
