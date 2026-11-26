const { TYPES } = require('../../../../gell-dispatch/rules/type');

const { describeType } = require('../describe');

exports.__metadata = {
    name: 'gell.domain.attributes',
    description: 'returns the param types (gell-dispatch/rules) attributes and params declare, with their rules',
    triggers: {
        effect: {
            params: {}
        },
        api: {
            params: {}
        }
    }
}

function listAttributes() {
    return Object.values(TYPES)
        .map(describeType)
        .sort((a, b) => a.name.localeCompare(b.name))
        ;
}

exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.domain.attributes")');

    return listAttributes();
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="gell.domain.attributes")');

    return listAttributes();
}
