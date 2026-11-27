const assert = require('assert');
const _ = require('lodash');

const { init } = require('gell/future');

const Store = require('gell-aws-dynamodb/store/single');

const { Registry } = require('../gell-metadata/registry');
const page = require('gell-aws-dynamodb/toolbox/page');

const { compileParams } = require('../gell-event/binding/compiler');
const { object } = require('../gell-dispatch/validate');

const queries = require('./toolbox/queries');
const write = require('./item/write');

/**
 * Single table DynamoDB store (gell-aws-dynamodb store/single) that keeps the named query and operation registries
 *  - store.queries (gell-discover Queries) and store.operations (gell-discover Operations): register definitions on
 *    them (e.g. store.queries.registerModule(queries)), which asserts their parameter types
 *  - query, find, drain and page run a definition's query, and a transaction's named operation its operation, with
 *    the args validated and coerced against the definition's parameters (gell-dispatch/validate object)
 *
 * a named query: { name, description, parameters, query, filter }
 *  - query: the DynamoDB (dynamodb-toolbox) query, or a function of the args that returns it
 *  - filter: (items, args) => the matching items, for the in-memory store (mock/store)
 *
 * a named operation: { name, description, parameters, operation, modify }
 *  - operation: the DynamoDB command, or a function of the request that returns it
 *  - modify: (item$, request) => the modified item, for the in-memory store (mock/store)
 *
 * parameters declare each parameter as a param does: its type's name, or { type, optional, validate }
 *  - each call's args are validated and coerced first (an Error named ObjectValidationError lists every failing
 *    parameter), and the definition gets the coerced args
 *
 * NOTE: a named operation's args are its request ({ name, key, values, ...args }); the definition gets the request
 * with its parameters coerced
 *
 * NOTE: the npm store's maps (namedQueries, namedOperations) are removed; the registries replace them
 */
module.exports = class extends Store {

    constructor(tableDef, deps) {
        super(tableDef, deps);

        delete this.namedQueries;
        delete this.namedOperations;

        this.queries = new Registry('query');
        this.operations = new Registry('operation');

        [this.$queries] = init(queries(this.queries, deps));
    }

    /**
     * NOTE: as gell-aws-dynamodb store/single page, with the definition's query run on its args, validated and coerced
     */
    page(namedQuery, args={}) {
        assert(_.isString(namedQuery), 'named query is required');

        const def = this.queries.get(namedQuery);
        assert(def, `no named query (name=${namedQuery}) defined`);

        assert(def.query, `named query (name=${namedQuery}) does not define a DynamoDB implementation`);
        const coerced = object(args, compileParams(def.parameters));
        const q = typeof def.query === 'function' ? def.query(coerced) : def.query;
        assert(q, `query (name=${namedQuery}) does not resolve to a toolbox query`);

        const { table, hash, options={} } = q;
        const tableObj = this._deps.resolveSingle(table);

        const keyAttributes = new Set();
        keyAttributes.add(this.tableDef.partitionKey);
        if (this.tableDef.sortKey) keyAttributes.add(this.tableDef.sortKey);
        const { index } = options;
        if (index) {
            const indexDef = this.tableDef.indexes[index];
            assert(indexDef, `no index (name=${index}) defined`);

            keyAttributes.add(indexDef.partitionKey);
            if (indexDef.sortKey) keyAttributes.add(indexDef.sortKey);
        }

        const [$page] = init(page(tableObj, Array.from(keyAttributes), hash, options));

        return $page;
    }

    write() {
        const [$txn] = init(write(this.tableDef.name, this._deps, { operations: this.operations }));

        return $txn;
    }

}
