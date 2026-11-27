const all = require('../../../snapshot/all');

exports.__metadata = {
    name: 'gell.domain.operations',
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

    logger.info('executing api (name="gell.domain.operations")');

    return all.effect({
        context: {
            registry_: store.operations
        },
        deps
    });
}
