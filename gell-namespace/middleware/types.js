const assert = require('assert');
const _ = require('lodash');

/**
 * gell-dispatch middleware namespacing the "types" registry per event: defines a clone of the registry, with the
 * namespace set, on the event's dependency container
 *  - for namespaces that vary per call, typically the caller's TENANT
 *  - static namespaces (ECOSYSTEM, APPLICATION) belong on the root types registry instead
 *
 * NOTE: event.deps must be the event's own container; gell-dispatch/bus branches deps for every invocation, so
 * defining types on it doesn't affect other events or the common container (don't run this outside the bus)
 *
 * NOTE: passes the event through unchanged when
 *  - the caller has no namespace id (internal or nested dispatch without a caller)
 *  - there is no types registry
 *  - the types registry already has the namespace id (nested dispatch inheriting namespaced types)
 *
 * NOTE: never sets the namespace on the registry it resolves; that registry is usually the shared root singleton
 *
 * @param {*} namespace namespace name (types actor), e.g. 'TENANT'
 * @param {*} namespaceIdOf caller => namespace id, e.g. caller => caller?.snapshotAttribute('tenantId')
 */
module.exports = function(namespace, namespaceIdOf) {
    assert(_.isString(namespace), 'namespace is required');
    assert(_.isFunction(namespaceIdOf), 'namespaceIdOf is required');

    return async function(event, resume) {
        const { caller, deps } = event;

        const namespaceId = namespaceIdOf(caller);

        if (!namespaceId) return resume(event);

        assert(_.isString(namespaceId), `namespace id (namespace=${namespace}) must be a string`);

        const types = deps.resolveSingle({ name: 'types', optional: true });

        if (!types) return resume(event);

        if (types.snapshotAttribute('namespace', namespace) === namespaceId) return resume(event);

        const namespacedTypes = types.clone();
        namespacedTypes.set('namespace', namespaceId, namespace);

        deps.define('types', namespacedTypes);

        return resume(event);
    }
}
