const assert = require('assert');
const EventEmitter = require('events');
const _ = require('lodash');

const { State } = require('gell');

/**
 * Namespaces the request's types: binds a clone of the types registry, with the request's namespaces set, to the
 * request context deps
 *  - ECOSYSTEM => the ecosystem
 *  - APPLICATION => the APPLICATION's id
 *  - TENANT => the session's TENANT (selected after sign in; see gell-auth/callback/jwt)
 *
 * NOTE: runs after the authorizer, so the session has a TENANT
 *
 * @param {*} application the APPLICATION (materialized)
 * @param {*} ecosystem the ecosystem's namespace id
 */
module.exports = function* namespaceLoader(application, ecosystem) {
    assert(application, 'application is required');
    assert(_.isString(ecosystem), 'ecosystem is required');

    const state = new State();
    const conf = new State();
    const events = new EventEmitter();

    async function doLoad(context) {
        assert(context, 'request context is required');

        const { deps, session } = context;

        const tenantId = session?.snapshotAttribute('tenantId');

        assert(tenantId, 'session tenantId is required');

        const namespacedTypes = deps.resolveSingle('types').clone();

        namespacedTypes.set('ECOSYSTEM', ecosystem);
        namespacedTypes.set('APPLICATION', application.id);
        namespacedTypes.set('TENANT', tenantId);

        context.deps = deps.branch({ types: namespacedTypes });
    }

    let args = yield { state, conf, events };

    while (true) args = yield doLoad(args);
}
