const assert = require('assert');
const _ = require('lodash');

const { init } = require('gell/future');

const Store = require('gell-aws-dynamodb/store/single');
const page = require('gell-aws-dynamodb/toolbox/page');

const named = require('./named');
const queries = require('./toolbox/queries');
const write = require('./item/write');

/**
 * Single table DynamoDB store (gell-aws-dynamodb store/single) that runs named query and operation definitions as
 * registered
 *  - configureQueries / configureOperations add definitions (maps by name, e.g. a query module or a registry's
 *    definitions()), asserting their parameter types; a definition that is a function is added as it is
 *  - query, find, drain and page run a definition's query, and a transaction's named operation its operation, with
 *    the args validated and coerced (see named)
 */
module.exports = class extends Store {

    constructor(tableDef, deps) {
        super(tableDef, deps);

        [this.$queries] = init(queries(this.namedQueries, deps));
    }

    configureQueries(...queries) {
        named.configure('query', this.namedQueries, ...queries);
    }

    configureOperations(...operations) {
        named.configure('operation', this.namedOperations, ...operations);
    }

    /**
     * NOTE: as gell-aws-dynamodb store/single page, with the query resolved by named.query
     */
    page(namedQuery, args={}) {
        assert(_.isString(namedQuery), 'named query is required');

        const def = this.namedQueries[namedQuery];
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
        const options = {
            namedOperations: this.namedOperations || {}
        }

        const [$txn] = init(write(this.tableDef.name, this._deps, options));

        return $txn;
    }

}
