const assert = require('assert');

exports.__metadata = {
    name: 'gell.domain.snapshot',
    description: 'returns a registered snapshot by name',
    triggers: {
        effect: {
            params: { name: 'string' }
        },
        api: {
            params: { name: 'string' }
        }
    }
}

/**
 * NOTE: registry.__snapshots is the registry's temporary map of registered modules (see gell-discover registry)
 */
exports.effect = async function({ params={}, deps }) {
    const { logger, registry } = deps.resolve('logger', 'registry');

    logger.info('executing effect (name="gell.domain.snapshot")');

    const { name } = params;

    assert(name, 'name is required');

    if (!registry.__snapshots[name]) return;

    return registry.snapshotAttribute(name);
}

/**
 * NOTE: gell-http's api wrapper crashes on an empty result, so a missing SNAPSHOT is reported as a 404 instead
 */
exports.api = async function({ params={}, deps }) {
    const snapshot$ = await exports.effect({ params, deps });

    if (!snapshot$) throw Object.assign(new Error(`snapshot not found (name=${params.name})`), { status: 404 });

    return snapshot$;
}
