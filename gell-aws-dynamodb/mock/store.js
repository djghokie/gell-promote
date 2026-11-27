const assert = require('assert');
const _ = require('lodash');

const { init } = require('gell/future');

const Store = require('gell-aws-dynamodb/mock/store');

const named = require('../named');
const queries = require('./queries');
const write = require('./write');

/**
 * In-memory store (gell-aws-dynamodb mock/store) that runs named query and operation definitions as registered
 *  - configureQueries / configureOperations add definitions (maps by name, e.g. a query module or a registry's
 *    definitions()), asserting their parameter types; a definition that is a function is added as it is
 *  - a named query runs its definition's filter, and a named operation its modify, with the args validated and
 *    coerced (see named)
 */
module.exports = class extends Store {

    constructor(...args) {
        super(...args);

        [this.$queries] = init(queries(this.namedQueries, this.saved));
    }

    configureQueries(...queries) {
        named.configure('query', this.namedQueries, ...queries);
    }

    configureOperations(...operations) {
        named.configure('operation', this.writeOptions.namedOperations, ...operations);
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
        const [$txn] = init(write(this, this.writeOptions));

        return $txn;
    }

    clear() {
        this.saved.length = 0;
        this.remove('lastSaved');
    }

}
