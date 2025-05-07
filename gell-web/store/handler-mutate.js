const assert = require('assert');

const { State } = require('gell');

/**
 * Handles incoming HTTP request and delegates to action trigger of event, via the event bus,
 * based on request path
 * 
 * @param {*} $bus
 * @param {*} middleware 
 */
module.exports = function* handler($bus, actionMap, middleware=[]) {
	assert($bus, '$bus is required');
	assert(middleware.length === 0, 'middleware functions not yet supported');

	const handler_ = new State();

	let context = yield handler_;

	async function handleRequest({ req, session, deps }) {
		const logger = deps.resolveSingle('logger');

        const { action } = req.body;
        if (action) {
            var eventName = action;
        } else {
            const type = req.query._event.join('.');
            var eventName = actionMap[type];
    
            assert(eventName, `mutate action (type=${type}) not mapped`);
        }

		logger.info(`triggering action for event (name=${eventName})`);

        const trigger = {
            route: `${eventName}#action`,
            caller: session,
            source: req,
            params: req.body,
        }

        return $bus.next(trigger).value;

        /*
		const error = new Error(`no event (name=${eventName}) defined`);
		error.status = 404;
		throw error;
        */
	}

	while (true) context = yield handleRequest(context);
}
