const assert = require('assert');
const _ = require('lodash');

exports.__metadata = {
    name: 'gell.inspect',
    description: 'inspect a named gell object',
    triggers: {
        effect: {},
        api: {
            params: {}
        }
    }
}

async function doInspect(name, deps) {
    assert(name);

    const { registry } = deps.resolve('registry');

    return registry.get(name);
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.inspect")');

    const { name } = params;

    return doInspect(name, deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="gell.inspect")');

    const { name } = params;

    return doInspect(name, deps);
}
