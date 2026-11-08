const assert = require('assert');
const _ = require('lodash');

exports.__metadata = {
    name: 'namespace.ecosystem',
    description: 'returns the ecosystem associated with the request',
    triggers: {
        api: {
            params: {}
        }
    }
}

exports.api = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="namesapce.ecosystem")');

    return context.ecosystem;
}