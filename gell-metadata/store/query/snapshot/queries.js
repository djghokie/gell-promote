const all = require('../../../snapshot/all');

exports.__metadata = {
    name: 'gell.domain.queries',
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

    logger.info('executing api (name="gell.domain.queries")');

    return all.effect({
        context: {
            registry_: store.queries
        },
        deps
    });
}
