const assert = require('assert');
const _ = require('lodash');

exports.__metadata = {
    name: 'gell.query',
    description: 'describes a Dynamodb query',
    triggers: {
        effect: {},
        api: {
            params: {}
        }
    }
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.query")');

    throw new Error('NYI');
}

exports.api = async function({ params={}, deps }) {
    const { logger, queryRegistry } = deps.resolve('logger', 'queryRegistry');

    logger.info('executing api (name="gell.query")');

    const { name } = params;

    return queryRegistry[name];
}
