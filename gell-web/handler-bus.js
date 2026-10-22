const assert = require('assert');
const _ = require('lodash');

const { State } = require('gell');

/**
 * Handles incoming HTTP request and delegates to a trigger of event, via the event bus,
 * based on request path
 * 
 * Used for both actions (trigger 'action') and snapshots (trigger 'api').  HTTP method
 * restrictions (actions don't allow GET requests) are enforced by the API route, not here
 * 
 * NOTE: replaces gell-web/action/handler-bus and gell-web/snapshot/handler-bus
 *  - passes the request context deps to the bus, so request scoped dependency overrides
 *    (e.g. namespaced types) reach the event
 * 
 * @param {*} $bus
 * @param {*} trigger name of the event trigger to invoke, e.g. 'action' or 'api'
 * @param {*} middleware 
 */
module.exports = function* handler($bus, trigger, middleware=[]) {
	assert($bus, '$bus is required');
	assert(_.isString(trigger) && trigger.length > 0, 'trigger is required');
	assert(middleware.length === 0, 'middleware functions not yet supported');

	const handler_ = new State();

	let context = yield handler_;

	async function handleRequest({ req, session, deps }) {
		const logger = deps.resolveSingle('logger');

		const eventName = req.query._event.join('.');

		logger.info(`triggering event (name=${eventName}; trigger=${trigger})`);

        return $bus.next({
            route: `${eventName}#${trigger}`,
            caller: session,
            source: req,
            params: req.method === 'POST' ? req.body : req.query,
            deps,
        }).value;
	}

	while (true) context = yield handleRequest(context);
}
