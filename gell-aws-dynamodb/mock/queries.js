const assert = require('assert');
const _ = require('lodash');

const { State } = require('gell');

const { compileParams } = require('../../gell-event/binding/compiler');
const { object } = require('../../gell-dispatch/validate');

/**
 * NOTE: gell-promote copy of gell-aws-dynamodb mock/queries: runs a named query definition's filter with the args
 * validated and coerced against its parameters (gell-dispatch/validate object; an ObjectValidationError lists every
 * failing parameter), looking definitions up in the store's registry (store.queries, a gell-metadata Registry); a
 * query error is yielded (the future survives it)
 */
/**
 * Implements named queries for mock implementations.  Yields stream of items returned from the
 * named query
 * 
 * NOTES
 * 	- a named query definition's filter is called with (items, queryArgs)
 * 	- named query can return an array, which will be converted to a stream (iterator)
 * 
 * @param {*} queries_ the store's query registry (gell-metadata Registry)
 * @param {*} items 
 */
module.exports = function* queries(queries_, items) {
	assert(queries_, 'queries_ is required');
	assert(_.isArray(items), 'queries future requires items array');

	let arg = yield new State();

	function doQuery({ namedQuery, ...queryArgs }) {
		assert(namedQuery, "namedQuery is required");

		const def = queries_.get(namedQuery);
		assert(def, `no named query (name=${namedQuery}) defined`);

		assert(def.filter, `named query (name=${namedQuery}) does not define a filter`);

		const result = def.filter(items, object(queryArgs, compileParams(def.parameters)));

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
