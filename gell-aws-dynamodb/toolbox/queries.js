const assert = require('assert');
const _ = require('lodash');

const { State } = require('gell');

const { query } = require('gell-aws-dynamodb/toolbox/stream');

const named = require('../named');

/**
 * NOTE: gell-promote copy of gell-aws-dynamodb toolbox/queries: runs a named query definition with named.query
 * (validates and coerces its args), looking definitions up in the store's registry (store.queries, a gell-discover
 * Queries)
 */
module.exports = function* queries(queries_, deps) {
	assert(queries_, 'queries_ is required');
	assert(deps, 'queries future requires deps');

	const logger = deps.resolveSingle('logger');

	let arg = yield new State();

	function doQuery({ namedQuery, ...queryArgs }) {
		assert(namedQuery, "namedQuery is required");

		const def = queries_.get(namedQuery);
		assert(def, `no named query (name=${namedQuery}) defined`);

		const q = named.query(namedQuery, def, queryArgs);
		assert(q, `query (name=${namedQuery}) does not resolve to a toolbox query`);

		const { table, hash, options } = q;

		assert(_.isString(table), `query (name=${namedQuery}) does not define a table`);

		const tableObj = deps.resolveSingle(table);

		const $items = query(tableObj, hash, options);
		assert(_.isFunction($items.next), `query (name=${namedQuery}) did not return a stream`);

		return $items;
	}
	
	do {
		try {
			arg = yield doQuery(arg || {});
		} catch (e) {
			logger.error(e);

			arg = yield e;
		}
	} while (true)
}
