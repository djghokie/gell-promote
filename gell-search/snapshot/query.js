const _ = require('lodash');

/**
 * Full-text search across the searchable models of the application
 *  - dependencies
 *      - searchEngine: ../engine/typesense or ../engine/memory
 *      - searchModels: array of gell domain models with searchable attributes (the application decides)
 *  - defines no roles; an application restricts the api trigger when it registers this module
 *      (gell-dispatch/util/restrict)
 *
 * WIP: per-model roles would let each role search only the types it can see
 * WIP: no TENANT filter
 */
const LIMIT = 10;

exports.__metadata = {
    name: 'search.query',
    description: 'search entities by text (name, email, phone, ...)',
    triggers: {
        effect: {
            params: {
                q: 'string',
            }
        },
        api: {
            params: {
                q: 'string',
                types: { type: 'string', optional: true, description: 'comma separated TYPEs to search (default all)' },
            }
        }
    }
}

async function search(q, types, filters, limit, deps) {
    const { searchEngine, searchModels } = deps.resolve('searchEngine', 'searchModels');

    const trimmed = (q || '').trim();
    if (trimmed.length === 0) return [];

    const models = types && types.length ? searchModels.filter(m => types.includes(m.name)) : searchModels;
    if (models.length === 0) return [];

    return searchEngine.search({ q: trimmed, models, filters, limit });
}

/**
 * @param {*} params { q, types: [TYPE], filters: { attribute: value }, limit }
 */
exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="search.query")');

    const { q, types, filters={}, limit=LIMIT } = params;

    return search(q, types, filters, limit, deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="search.query")');

    const { q, types } = params;

    return search(q, types ? _.compact(types.split(',').map(t => t.trim())) : undefined, {}, LIMIT, deps);
}
