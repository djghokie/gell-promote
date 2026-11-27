const assert = require('assert');
const _ = require('lodash');

exports.__metadata = {
    name: 'gell.registry.all',
    description: 'describe all entries in a registry',
    triggers: {
        effect: {},
        api: {
            params: {}
        }
    }
}

function doList(registry_, deps) {
    const { store } = deps.resolve('store');

    return Array.from(registry_.names())
        .map(name => registry_.describe(name))
        .sort((a, b) => a.name.localeCompare(b.name))
        ;
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.registry.all")');

    const { registry_ } = context;

    return doList(registry_, deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="gell.registry.all")');

    throw new Error('NYI');
}
