const assert = require('assert');
const _ = require('lodash');

const { State } = require('gell');

const { TransactWriteCommand } = require("@aws-sdk/lib-dynamodb");

const named = require('../named');

const DEFAULT_OPTIONS = {
	namedOperations: {}
}

/**
 * NOTE: gell-promote copy of gell-aws-dynamodb item/write: namedOperation runs a named operation definition with
 * named.operation (validates and coerces its request), so the store holds the definitions as registered (no
 * operation-wrapper); an object definition declares its command as operation
 */
/**
 * Implements a "transaction write" future.  Each call to next represents an operation in the
 * transaction.  Calling "return" commits the transaction
 * 
 * Although writing to multiple tables in a single transaction is supported by DynamoDB, this
 * implementation only applies to a single table (passed in during creation of future)
 * 
 * WIP: specifying item keys
 * 	- if this is for a single table, then the item keys should be specified during creation
 * 		- rather than making client specify them
 * 
 * @param {*} tableName 
 * @param {*} deps 
 * @param {*} options 
 * @returns 
 */
module.exports = function* write(tableName, deps, options={}) {
	assert(_.isString(tableName), 'tableName is required');
	assert(deps, 'deps is required');

	const state = new State();

	// TODO: store following with State
	const mergedOptions = _.defaults(options, DEFAULT_OPTIONS);
	const requests = [];
	let error = false;

	function put({ item }) {
		assert(item, 'item is required');

		const Item = _.isFunction(item.snapshot) ? item.snapshot('dynamodb') : item;

		return {
			Put: {
				TableName: tableName,
				Item
			},
		}
	}

	/**
	 * WIP: trying to figure out approaches here...
	 * 	- generating command with expressions would be tough
	 * 	- would be nice to pass in State here
	 * 	- support named updates (similar to named queries)
	 * 	- maybe UpdateExpression and values projection is the way to go here
	 * 		- this still cant be mocked easily tho
	 * 
	 * @param {*} request 
	 * @returns 
	 */
	function update(request) {
		/**
			TableName: `${process.env.DYNAMODB_PREFIX}.session`,
			Key: {
				type: ITEM.type,
				id: ITEM.id
			},
			UpdateExpression: 'SET a=:a',
			ExpressionAttributeValues: {
				":a": 101
			}
		 */

		throw new Error('not yet supported; use named operations');
	}

	/**
	 * WIP: see note above re: key
	 * 	- should allow clients to pass in full item instead of just the key
	 * 	- derive the key
	 */
	function explicit({ command, key, values }) {
		assert(command, 'command is required');

		const instance = Object.assign({}, command);

		const commandBody = Object.values(instance)[0];
		assert(commandBody, `no command body for explicit operation`);

		if (!commandBody.TableName) commandBody.TableName = tableName;

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

	/**
	 * Add a named operation to transaction
	 * 
	 * WIP: what does this currently support?
	 * 	- static def
	 * 	- function def
	 * 	- predefined table name
	 * 
	 * WIP: future support
	 * 	- key
	 * 
	 * @param {*} request 
	 * @returns 
	 */
	function namedOperation(request) {
		const def = mergedOptions.namedOperations[request.name];

		// NOTE: copied, as explicit fills in the command (a static operation is shared by every request)
		const command = Object.assign({}, named.operation(request.name, def, request));

		const { key, values } = request;

		return explicit({ command, key, values });
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

			assert(mergedOptions.namedOperations[name], `no named operation (name=${request.name})`);
		} else {
			assert(_.isString(operation));

			const opF = OPERATIONS[operation];
			assert(opF, `unknown operation (name=${operation})`);
		}

		requests.push(request);
	}

	async function commit() {
		const { logger, dynamodb } = await deps.resolve('logger', 'dynamodb');

		if (requests.length < 1) return logger.warn('nothing to commit');

		logger.info(`committing operations (${requests.length})`);

		const TransactItems = requests.map(request => {
			if (request.name) {
				return namedOperation(request);
			} else {
				const opF = OPERATIONS[request.operation];
	
				return opF(request);
			}
		})

		const params = { TransactItems }

		// console.debug('######', JSON.stringify(params, null, 2));

		return dynamodb.send(new TransactWriteCommand(params));
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

