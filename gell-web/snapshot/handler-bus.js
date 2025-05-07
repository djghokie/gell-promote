const assert = require('assert');

const { State } = require('gell');

/**
 * Handles incoming HTTP request and delegates to API trigger of event, via the event bus,
 * based on request path
 * 
 * WIP: this could probably be combined with implementation for actions
 *  - event trigger is 'api' instead of 'action'
 *  - actions don't allow GET requests
 * 
 * @param {*} $bus
 * @param {*} middleware 
 */
module.exports = function* handler($bus, middleware=[]) {
	assert($bus, '$bus is required');
	assert(middleware.length === 0, 'middleware functions not yet supported');

	const handler_ = new State();

	let context = yield handler_;

	async function handleRequest({ req, session, deps }) {
		const logger = deps.resolveSingle('logger');

		const eventName = req.query._event.join('.');

		logger.info(`triggering API for event (name=${eventName})`);

        const trigger = {
            route: `${eventName}#api`,
            caller: session,
            source: req,
            params: req.method === 'POST' ? req.body : req.query,
        }

        return $bus.next(trigger).value;
	}

	while (true) context = yield handleRequest(context);
}
