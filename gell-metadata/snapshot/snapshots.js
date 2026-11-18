exports.__metadata = {
    name: 'gell.domain.snapshots',
    description: 'returns all registered snapshots',
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
 * NOTE: registry.__snapshots is the registry's temporary map of registered modules (see gell-discover registry)
 */
exports.effect = async function({ params={}, deps }) {
    const { logger, registry } = deps.resolve('logger', 'registry');

    logger.info('executing effect (name="gell.domain.snapshots")');

    return Object.keys(registry.__snapshots)
        .map(name => registry.snapshotAttribute(name))
        .sort((a, b) => a.name.localeCompare(b.name))
        ;
}

exports.api = exports.effect;
