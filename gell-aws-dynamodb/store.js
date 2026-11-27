const assert = require('assert');
const _ = require('lodash');

const { init } = require('gell/future');

const Store = require('gell-aws-dynamodb/store/single');

const { Queries } = require('../gell-discover/domain/queries');
const { Operations } = require('../gell-discover/domain/operations');
const page = require('gell-aws-dynamodb/toolbox/page');

const named = require('./named');
const queries = require('./toolbox/queries');
const write = require('./item/write');

/**
 * Single table DynamoDB store (gell-aws-dynamodb store/single) that keeps the named query and operation registries
 *  - store.queries (gell-discover Queries) and store.operations (gell-discover Operations): register definitions on
 *    them (e.g. store.queries.registerModule(queries)), which asserts their parameter types
 *  - query, find, drain and page run a definition's query, and a transaction's named operation its operation, with
 *    the args validated and coerced (see named)
 *
 * NOTE: the npm store's maps (namedQueries, namedOperations) are removed; the registries replace them
 */
module.exports = class extends Store {

    constructor(tableDef, deps) {
        super(tableDef, deps);

        delete this.namedQueries;
        delete this.namedOperations;

        this.queries = new Queries();
        this.operations = new Operations();

        [this.$queries] = init(queries(this.queries, deps));
    }

    /**
     * NOTE: as gell-aws-dynamodb store/single page, with the query resolved by named.query
     */
    page(namedQuery, args={}) {
        assert(_.isString(namedQuery), 'named query is required');

        const def = this.queries.get(namedQuery);
        assert(def, `no named query (name=${namedQuery}) defined`);

        const q = named.query(namedQuery, def, args);
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
