const assert = require('assert');
const _ = require('lodash');

/**
 * gell-dispatch middleware namespacing the "types" registry per event: the event runs with a branch of its deps
 * whose types is a clone of the registry with the namespace set
 *  - for namespaces that vary per call, typically the caller's TENANT
 *  - static namespaces (ECOSYSTEM, APPLICATION) belong on the root types registry instead
 *
 * NOTE: passes the event through unchanged when
 *  - the caller has no namespace id (internal or nested dispatch without a caller)
 *  - there is no types registry
 *  - the types registry already has the namespace id (nested dispatch with already namespaced deps)
 *
 * NOTE: never sets the namespace on the registry it resolves; that registry is usually the shared root singleton
 *
 * WIP: cloning per event is a stand-in for the bus branching deps by default (see TODO.md "General")
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

        return resume({ ...event, deps: deps.branch({ types: namespacedTypes }) });
    }
}
