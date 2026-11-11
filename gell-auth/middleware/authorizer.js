const assert = require('assert');
const EventEmitter = require('events');

const { State } = require('gell');

function unauthorized(message, status) {
    const e = new Error(message);

    // NOTE: gell-http/next/api responds with the error's status
    e.status = status;

    return e;
}

/**
 * Authorizes an API request: the session must have selected a TENANT (and so have a role in it)
 *  - no session => 401
 *  - no TENANT or role => 403
 *
 * NOTE: runs after the session loader (context.session is the BROWSER session)
 *
 * WIP: temporary api authorization
 *  - only checks for existence of role
 *  - should be combined with bus middleware (check snapshot metadata for authorization)
 */
module.exports = function* authorizer() {
    const state = new State();
    const conf = new State();
    const events = new EventEmitter();

    async function doAuthorize(context) {
        assert(context, 'request context is required');

        const { session } = context;

        if (!session) throw unauthorized('unauthorized', 401);

        const { tenantId, role } = session.snapshotPartial(['tenantId', 'role']);

        if (!tenantId || !role) throw unauthorized('forbidden', 403);
    }

    let args = yield { state, conf, events };

    while (true) args = yield doAuthorize(args);
}
