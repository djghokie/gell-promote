const assert = require('assert');
const _ = require('lodash');

exports.__metadata = {
    name: 'gell.registry.describe',
    description: 'describe a single entry in a registry',
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
 * plain-object metadata of the named entry ({ name, description, parameters }), or undefined when the registry has
 * no entry by that name
 */
function doDescribe(registry_, name) {
    assert(registry_, 'registry_ is required');
    assert(name, 'name is required');

    return registry_.describe(name);
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    const { name } = params;

    logger.info(`executing effect (name="gell.registry.describe"; entry=${name})`);

    const { registry_ } = context;

    return doDescribe(registry_, name);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="gell.registry.describe")');

    throw new Error('NYI');
}
