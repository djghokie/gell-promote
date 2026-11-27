const all = require('../../gell-metadata/snapshot/all');

exports.__metadata = {
    name: 'store.named.operations',
    description: 'returns all registered named operations',
    triggers: {
        effect: {
            params: {}
        },
        api: {
            params: {}
        }
    }
}

exports.api = async function({ params={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');

    logger.info('executing api (name="store.named.operations")');

    return all.effect({
        context: {
            registry_: store.operations
        },
        deps
    });
}
