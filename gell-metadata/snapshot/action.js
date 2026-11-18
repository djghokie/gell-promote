const assert = require('assert');

exports.__metadata = {
    name: 'gell.domain.action',
    description: 'returns a registered action by name',
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
 * NOTE: registry.__events is the registry's temporary map of registered modules (see gell-discover registry)
 */
exports.effect = async function({ params={}, deps }) {
    const { logger, registry } = deps.resolve('logger', 'registry');

    logger.info('executing effect (name="gell.domain.action")');

    const { name } = params;

    assert(name, 'name is required');

    if (!registry.__events[name]) return;

    return registry.snapshotAttribute(name);
}

/**
 * NOTE: gell-http's api wrapper crashes on an empty result, so a missing ACTION is reported as a 404 instead
 */
exports.api = async function({ params={}, deps }) {
    const action$ = await exports.effect({ params, deps });

    if (!action$) throw Object.assign(new Error(`action not found (name=${params.name})`), { status: 404 });

    return action$;
}
