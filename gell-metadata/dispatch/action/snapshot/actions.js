exports.__metadata = {
    name: 'gell.domain.actions',
    description: 'returns all registered actions',
    triggers: {
        effect: {
            params: {}
        },
        api: {
            params: {}
        }
    }
}

/**
 * NOTE: registry.__events is the registry's temporary map of registered modules (see gell-discover registry)
 */
function listActions(deps) {
    const { registry } = deps.resolve('registry');

    return Object.keys(registry.__events)
        .map(name => registry.snapshotAttribute(name))
        .sort((a, b) => a.name.localeCompare(b.name))
        ;
}

exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.domain.actions")');

    return listActions(deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="gell.domain.actions")');

    return listActions(deps);
}
