const assert = require('assert');
const _ = require('lodash');

const lookup = require('../tenant/snapshot/tenant');
const tenant = require('../domain/tenant');

/**
 * gell-dispatch middleware that puts the caller's TENANT on the event context, under a specified key (default tenant_)
 *  - only for triggers that declare the key in their context metadata, e.g. triggers.action.context.tenant_; other
 *    events pay no lookup
 *  - the TENANT is looked up by the caller's TENANT id (see namespaceIdOf) and materialized (a State)
 *
 * NOTE: passes the event through unchanged when
 *  - the trigger doesn't declare the key
 *  - the context already has the key (jobs, tests and nested dispatches pass the TENANT themselves)
 *  - the caller has no TENANT id; a trigger declaring the key as required is then rejected by the attributes
 *    middleware (run this before it)
 *
 * NOTE: fails if the caller's TENANT isn't persisted (namespace.tenant.lookup, failIfNotFound)
 *
 * @param {*} tenantIdOf caller => TENANT id, e.g. caller => caller?.snapshotAttribute('tenantId')
 * @param {*} key context key, default 'tenant_'
 */
module.exports = function(tenantIdOf, key='tenant_') {
    assert(_.isFunction(tenantIdOf), 'tenantIdOf is required');
    assert(_.isString(key) && key.length > 0, 'key is required');

    return async function(event, resume) {
        const { caller, context, deps, __invocationSpec } = event;

        const declared = _.get(__invocationSpec, ['triggerSpec', 'context', key]);

        if (!declared || context[key] !== undefined) return resume(event);

        const tenantId = tenantIdOf(caller);

        if (!tenantId) return resume(event);

        assert(_.isString(tenantId), 'TENANT id must be a string');

        const tenant$ = await lookup.effect({ params: { id: tenantId }, deps });

        context[key] = tenant.materialize(tenant$);

        return resume(event);
    }
}
