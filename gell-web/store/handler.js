const assert = require('assert');

const { State } = require('gell');

module.exports = function* dispatcher(catalog, middleware=[]) {
	assert(catalog, 'event catalog is required');
	assert(middleware.length < 2, 'multiple middleware functions not yet supported');

	const dispatcher_ = new State();

	let context = yield dispatcher_;

	function resolveEvent(parts) {
		do {
			const eventName = parts.join('.');

			console.debug('#####', eventName);

			parts.pop();

			var metadata, trigger;
		} while ((!metadata || !trigger) && parts.length > 0);
	}

	async function handleRequest({ req, session, deps }) {
		const logger = deps.resolveSingle('logger');

		const eventName = req.query._event.join('.');

		logger.info(`handling action event (name=${eventName})`);

		resolveEvent(req.query._event);
	
		const [metadata, trigger] = catalog.lookupTrigger(eventName, 'api');
		if (metadata && trigger) {
			// TODO: validate arguments
			// TODO: authorize event
			// TODO: associate session

			const event = {
				caller: session,
				source: req,
				params: req.method === 'POST' ? req.body : req.query,
				context: {
					// $txn
				},
				deps
			}

			if (middleware.length === 0) return trigger(event);

			return middleware[0](z => trigger(event), event);
		}

		const error = new Error(`no event (name=${eventName}) defined`);
		error.status = 404;
		throw error;
	}

	while (true) context = yield handleRequest(context);
}
