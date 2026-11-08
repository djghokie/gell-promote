const assert = require('assert');
const EventEmitter = require('events');

const { getServerSession } = require("next-auth");

const { State } = require('gell');
const browser = require('../../gell-web/domain/browser');

// const sessionLoader = require('gell-web/middlware/session');
// const apiAuthorizer = require('gell-web/middlware/authorizer');

/**
 * Binds the next-auth session to the request context
 *  - NOTE: this isn't the context parameter passed into APIs
 *      - this is the request context passed from Next.js to api handler
 * 
 * @param {*} authOptions 
 */
module.exports = function* sessionLoader(authOptions) {
	const state = new State();
	const conf = new State();
	const events = new EventEmitter();

    /**
     * WIP: might need to look this up or convert to a gell-web session
     */
	async function bindSession(context) {
		assert(context, 'request context is required');

        const session = await getServerSession(context.req, context.res, authOptions);

        if (session)
            // NOTE: the session callback (gell-auth/callback/session) defines the session's fields, including userId
            context.session = browser.materialize(session);
	}

	let args = yield { state, conf, events };

	while (true) args = yield bindSession(args);
}
