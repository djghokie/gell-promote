const assert = require('assert');
const _ = require('lodash');

exports.__metadata = {
    name: 'unittest.snapshot',
    description: '"unittest.snapshot" event',
    triggers: {
        effect: {},
        api: {
            params: {}
        }
    }
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="unittest.snapshot")');

    throw new Error('NYI');
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="unittest.snapshot")');

    throw new Error('NYI');
}