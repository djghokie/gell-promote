const all = require('../../gell-metadata/snapshot/all');

exports.__metadata = {
    name: 'store.named.queries',
    description: 'returns all registered named queries',
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

    logger.info('executing api (name="store.named.queries")');

    return all.effect({
        context: {
            registry_: store.queries
        },
        deps
    });
}
