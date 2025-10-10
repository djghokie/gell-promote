const assert = require('assert');
const _ = require('lodash');

exports.__metadata = {
    name: 'unittest.event',
    description: '"uniitest.etent" event',
    triggers: {
        effect: {},
        action: {}
    }
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="unittest.event")');

    throw new Error('NYI');
}

exports.action = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing action (name="unittest.event")');

    
    throw new Error('NYI');
}