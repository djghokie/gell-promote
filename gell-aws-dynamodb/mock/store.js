const assert = require('assert');
const _ = require('lodash');

const { init } = require('gell/future');

const Store = require('gell-aws-dynamodb/mock/store');

const { Queries } = require('../../gell-discover/domain/queries');
const { Operations } = require('../../gell-discover/domain/operations');

const queries = require('./queries');
const write = require('./write');

/**
 * In-memory store (gell-aws-dynamodb mock/store) that keeps the named query and operation registries
 *  - store.queries (gell-discover Queries) and store.operations (gell-discover Operations): register definitions on
 *    them (e.g. store.queries.registerModule(queries)), which asserts their parameter types
 *  - a named query runs its definition's filter, and a named operation its modify, with the args validated and
 *    coerced (see named)
 */
module.exports = class extends Store {

    constructor(...args) {
        super(...args);

        // NOTE: the npm store's maps (namedQueries, writeOptions.namedOperations) are removed; the registries replace them
        delete this.namedQueries;
        delete this.writeOptions;

        this.queries = new Queries();
        this.operations = new Operations();

        [this.$queries] = init(queries(this.queries, this.saved));
    }

    /**
     * NOTE: throws the error a named query yields (e.g. an argument that fails validation)
     */
    query(namedQuery, queryArgs) {
        assert(_.isString(namedQuery), 'named query is required');

        const $items = this.$queries.next({ namedQuery, ...queryArgs }).value;

        if (_.isError($items)) throw $items;

        assert($items && _.isFunction($items.next), `query (name=${namedQuery}) did not return a stream`);

        return $items;
    }

    write() {
        const [$txn] = init(write(this, { operations: this.operations }));

        return $txn;
    }

    clear() {
        this.saved.length = 0;
        this.remove('lastSaved');
    }

}
