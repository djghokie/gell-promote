const assert = require('assert');

const tenantLookup = require('gell-promote/gell-namespace/tenant/snapshot/tenant');
const member = require('gell-promote/gell-web/member/domain/member');

const typeItems = require('gell-promote/gell-metadata/snapshot/items');

// NOTE: name of the namespace TENANT-scoped types are registered with (<prefix>-integration/domain/types.js)
const NAMESPACE = 'TENANT';

exports.__metadata = {
    name: 'gell.tenant.items',
    description: 'returns a TENANT, every item stored under its namespace and its MEMBERs',
    triggers: {
        effect: {
            params: { id: 'string' }
        }
    }
}

/**
 * NOTE: TENANT data is stored under the namespaced type (<TENANT id>::<TYPE>) of every TYPE registered
 * with the TENANT namespace: the admin buses' types middleware namespaces by the session's tenantId
 *
 * WIP: items of TYPEs not registered with the types registry (or registered without the TENANT namespace)
 * are not found, even if a TENANT's data references them
 */
async function fetchItems(namespaceId, deps) {
    const { logger } = deps.resolve('logger');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    // NOTE: without the types registry no TYPEs are registered with the TENANT namespace
    const names = !types ? [] : Array.from(types.names()).filter(name => types.namespacedTypes[name] === NAMESPACE);

    const items$ = [];

    for (const name of names) {
        const typeItems$ = await typeItems.effect({ params: { name, namespace: namespaceId }, deps });

        logger.info(`loaded tenant items (namespace=${namespaceId}; type=${name}; count=${typeItems$.length})`);

        items$.push(...typeItems$);
    }

    return items$;
}

/**
 * NOTE: MEMBERs are APPLICATION-scoped (<APPLICATION id>::WEB#MEMBER) children of the TENANT; all of them,
 * active or not, so a delete leaves none behind
 */
async function fetchMembers(tenantId, application, deps) {
    const { store } = deps.resolve('store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    const type = types ? types.name(member.TYPE, application?.id) : member.TYPE;

    return store.drain('session.children', { type, parentId: tenantId });
}

/**
 * context.application: the APPLICATION MEMBERs are scoped to (default: the registered APPLICATION namespace)
 */
exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.tenant.items")');

    const { id } = params;

    assert(id, 'id is required');

    const tenant$ = await tenantLookup.effect({ params: { id }, deps });

    const items$ = await fetchItems(tenant$.id, deps);
    const members$ = await fetchMembers(tenant$.id, context.application, deps);

    return { tenant$, items$, members$ };
}
