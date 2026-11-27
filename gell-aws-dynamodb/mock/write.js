const assert = require('assert');
const _ = require('lodash');

const { State } = require('gell');

const { compileParams } = require('../../gell-event/binding/compiler');
const { object } = require('../../gell-dispatch/validate');

/**
 * NOTE: gell-promote copy of gell-aws-dynamodb mock/write: namedOperation runs a named operation definition's modify
 * with the request validated and coerced against its parameters (gell-dispatch/validate object; an
 * ObjectValidationError lists every failing parameter), looking definitions up in the store's registry
 * (options.operations: store.operations, a gell-metadata Registry)
 */
/**
 * Mocks a write transaction
 * 
 * WIP: only implemented Put operations
 * 
 * WIP: this isn't an accurate mock yet
 * 	- uses store currently
 * 		- this should be removed
 * 		- pass in items array (from store)
 * 		- future should have same signature as put
 * 	- should simulate all/nothing behavior of a real transaction
 * 	- missing other operations
 * 		- update
 * 		- delete
 * 		- condition check
 * 
 * @param {*} store 
 * @returns 
 */
module.exports = function* write(store, options) {
	assert(store, 'store is required')
	const { operations: operations_ } = options || {};
	assert(operations_, 'options.operations is required');

	const state = new State();

	// TODO: store following with State
	const requests = [];
	let error = false;

	async function put({ item }) {
		const item$ = _.isFunction(item.snapshot) ? item.snapshot('dynamodb') : item;

		await store.save(item$);

		return {
			Put: {
				Item: item$
			}
		}
	}

	/**
	 * WIP: return snapshot of the item here?
	 * 
	 * @param {*} item 
	 */
	async function update(item) {
		// await store.update(item);
		throw new Error('not yet supported; use named operations');
	}

	function explicit({ command, key, values }) {
		assert(command, 'command is required');

		const instance = Object.assign({}, command);

		const commandBody = Object.values(instance)[0];
		assert(commandBody, `no command body for explicit operation`);

		if (!commandBody.Key && key)
			commandBody.Key = _.isFunction(key.snapshot) ? key.snapshot() : key;

		if (!commandBody.ExpressionAttributeValues && values) {
			if (_.isFunction(values.snapshot)) {
				var ExpressionAttributeValues = values.snapshot();
			} else {
				var ExpressionAttributeValues = values;
			}

			commandBody.ExpressionAttributeValues = ExpressionAttributeValues;
		}

		return command;
	}

	async function namedOperation(request) {
		const def = operations_.get(request.name);

		assert(def, `namedOperation (name=${request.name}) is not mocked`);

		const { key } = request;
		if (key)
			var item = await store.lookup(_.isFunction(key.snapshot) ? key.snapshot() : key);

		assert(def.modify, `named operation (name=${request.name}) does not define modify`);

		return def.modify(item, object(request, compileParams(def.parameters)));
	}

	const OPERATIONS = {
		put,
		update,
		explicit
	}

	function addRequest(request={}) {
		const { operation, name } = request;

		if (name) {
			assert(_.isString(name, '"name" must be string referencing named operation'));

			assert(operations_.get(name), `no named operation (name=${request.name})`);
		} else {
			assert(_.isString(operation));

			const opF = OPERATIONS[operation];
			assert(opF, `unknown operation (name=${operation})`);
		}

		requests.push(request);
	}

	async function commit() {
		return Promise.all(requests.map(async request => {
			if (request.name) return namedOperation(request);

			return OPERATIONS[request.operation](request);
		}));
	}

	try {
		let args = yield state;

		while (true) args = yield addRequest(args || {})
	} catch(e) {
		error = true;

		throw e;
	} finally {
		if (!error) return commit();
	}
}
