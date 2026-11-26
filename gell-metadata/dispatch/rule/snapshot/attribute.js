const assert = require('assert');

const { TYPES } = require('../../../../gell-dispatch/rules/type');

const { describeType } = require('../describe');

exports.__metadata = {
    name: 'gell.domain.attribute',
    description: 'returns a param type (gell-dispatch/rules) by name, with its rules',
    triggers: {
        effect: {
            params: { name: 'string' }
        },
        api: {
            params: { name: 'string' }
        }
    }
}

exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.domain.attribute")');

    const { name } = params;

    assert(name, 'name is required');

    if (!Object.hasOwn(TYPES, name)) return;

    return describeType(TYPES[name]);
}

/**
 * NOTE: gell-http's api wrapper crashes on an empty result, so a missing type is reported as a 404 instead
 */
exports.api = async function({ params={}, deps }) {
    const type$ = await exports.effect({ params, deps });

    if (!type$) throw Object.assign(new Error(`param type not found (name=${params.name})`), { status: 404 });

    return type$;
}
