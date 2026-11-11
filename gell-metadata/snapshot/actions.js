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
exports.effect = async function({ params={}, deps }) {
    const { logger, registry } = deps.resolve('logger', 'registry');

    logger.info('executing effect (name="gell.domain.actions")');

    return Object.keys(registry.__events)
        .map(name => registry.snapshotAttribute(name))
        .sort((a, b) => a.name.localeCompare(b.name))
        ;
}

exports.api = exports.effect;
