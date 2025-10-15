const assert = require('assert');
const _ = require('lodash');

/**
 * WIP: back to figuring out the best way to manage a catalog of modules
 *  - catalog of queries needed for the following
 *      - store.namedQueries
 *          - this is currently just a map
 *          - metadata isn't included
 *      - this snapshot
 *  - is there a compilation process?
 */
exports.__metadata = {
    name: 'gell.queries',
    description: 'returns all discovered gell-aws-dynamodb queries',
    triggers: {
        effect: {},
        api: {
            params: {}
        }
    }
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.queries")');

    throw new Error('NYI');
}

exports.api = async function({ params={}, deps }) {
    const { logger, queryRegistry } = deps.resolve('logger', 'queryRegistry');

    logger.info('executing api (name="gell.queries")');

    return Object.values(queryRegistry).map(q => {
        return {
            name: q.name,
            description: q.description
        }
    });
}
