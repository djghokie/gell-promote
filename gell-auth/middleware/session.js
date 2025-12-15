const assert = require('assert');
const EventEmitter = require('events');

const { getServerSession } = require("next-auth");

const { State } = require('gell');
const browser = require('../../gell-web/domain/browser');

// const sessionLoader = require('gell-web/middlware/session');
// const apiAuthorizer = require('gell-web/middlware/authorizer');

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

        if (session) {
            context.session = browser.materialize({
                userId: session.user.email,
                user: session.user,
                role: session.role,
            });
        }
	}

	let args = yield { state, conf, events };

	while (true) args = yield bindSession(args);
}
