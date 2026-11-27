const assert = require('assert');
const _ = require('lodash');

const { State } = require('gell');

const named = require('../named');

/**
 * NOTE: gell-promote copy of gell-aws-dynamodb mock/queries: runs a named query definition's filter with
 * named.filter (validates and coerces its args), so the store holds the definitions as registered (no query-wrapper);
 * a query error is yielded (the future survives it)
 */
/**
 * Implements named queries for mock implementations.  Yields stream of items returned from the
 * named query
 * 
 * NOTES
 * 	- named query must resolve to a function
 * 		- arguments to function are (items, queryArgs)
 * 	- named query can return an array, which will be converted to a stream (iterator)
 * 
 * @param {*} namedQueries 
 * @param {*} items 
 */
module.exports = function* queries(namedQueries, items) {
	assert(namedQueries, 'namedQueries is required');
	assert(_.isArray(items), 'queries future requires items array');

	let arg = yield new State();

	function doQuery({ namedQuery, ...queryArgs }) {
		assert(namedQuery, "namedQuery is required");

		const def = namedQueries[namedQuery];
		assert(def, `no named query (name=${namedQuery}) defined`);

		const result = named.filter(namedQuery, def, items, queryArgs);

		if (_.isUndefined(result)) return;  // WIP: is this right?
		if (_.isArray(result)) return result.values();
		if (_.isFunction(result.next)) return result;

		throw new Error(`named query result (${typeof result}) not supported`);
	}
	
	// NOTE: an error (e.g. an argument that fails validation) is yielded, not thrown, so the future survives it and
	// later queries still run (as in toolbox/queries); the store's query throws it
	do {
		try {
			arg = yield doQuery(arg || {});
		} catch (e) {
			arg = yield e;
		}
	} while (true)
}
