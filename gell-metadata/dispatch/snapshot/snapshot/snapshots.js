const { describe } = require('../../../../gell-event/binding/compiler');

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
function listSnapshots(deps) {
    const { registry } = deps.resolve('registry');

    return Object.keys(registry.__snapshots)
        .map(name => registry.snapshotAttribute(name))
        .sort((a, b) => a.name.localeCompare(b.name))
        ;
}

exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.domain.snapshots")');

    return listSnapshots(deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="gell.domain.snapshots")');

    return listSnapshots(deps).map(describe);
}
