const assert = require('assert');

const ROLE_ADMINISTRATOR = 'administrator';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

exports.__metadata = {
    name: 'gell.domain.query.run',
    description: 'runs a registered named query with arguments, returning at most limit items',
    triggers: {
        effect: {
            params: {
                name: 'string',
                args: { type: 'object', optional: true },
                limit: { type: 'number', optional: true }
            }
        },
        api: {
            params: {
                name: 'string',
                args: { type: 'object', optional: true },
                limit: { type: 'number', optional: true }
            }
        }
    }
}

function httpError(message, status) {
    return Object.assign(new Error(message), { status });
}

/**
 * NOTE: a POST body carries args as an object; a GET passes them as a JSON query string parameter
 */
function parseArgs(args) {
    if (typeof args !== 'string') return args;

    try {
        return JSON.parse(args);
    } catch {
        throw httpError(`args must be JSON (args=${args})`, 400);
    }
}

/**
 * Coerces form values to the query's declared parameter types and drops empty ones, so an optional
 * parameter left blank is omitted rather than queried as ''
 *
 * WIP: only number/timestamp/boolean are coerced; compile parameters with gell-domain once Queries does
 */
function coerceArgs(query$, args={}) {
    const coerced = {};

    query$.parameters.forEach(({ name, type, optional }) => {
        let val = args[name];

        if (val === undefined || val === null || val === '') {
            if (!optional) throw httpError(`query (name=${query$.name}) missing required parameter (name=${name})`, 400);

            return;
        }

        if ((type === 'number' || type === 'timestamp') && typeof val === 'string') {
            val = Number(val);

            if (Number.isNaN(val)) throw httpError(`query (name=${query$.name}) parameter (name=${name}) must be a number`, 400);
        }

        if (type === 'boolean' && typeof val === 'string') val = val === 'true';

        coerced[name] = val;
    });

    return coerced;
}

/**
 * NOTE: reads one item past limit so a capped result reports truncated
 */
async function take($items, limit) {
    const items$ = [];

    let next;
    do {
        next = await $items.next();

        if (next && next.value) items$.push(next.value);
    } while (next && !next.done && items$.length <= limit)

    if (!next.done && $items.return) await $items.return();

    return {
        items: items$.slice(0, limit),
        truncated: items$.length > limit,
    };
}

exports.effect = async function({ params={}, deps }) {
    const { logger, queries, store } = deps.resolve('logger', 'queries', 'store');

    const { name, args={}, limit=DEFAULT_LIMIT } = params;

    logger.info(`executing effect (name="gell.domain.query.run"; query=${name})`);

    assert(name, 'name is required');

    const query$ = queries.describe(name);

    if (!query$) return;

    const limit_ = Math.min(Math.max(parseInt(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

    const queryArgs = coerceArgs(query$, parseArgs(args));

    const result$ = await take(store.query(name, queryArgs), limit_);

    return { name, args: queryArgs, limit: limit_, ...result$ };
}

/**
 * NOTE: running a query reads any item in the table, so the api is limited to administrators (apiAuthorizer
 * only checks that the caller has a role); gell-http's api wrapper crashes on an empty result, so a missing
 * query is reported as a 404 instead
 */
exports.api = async function({ caller, params={}, deps }) {
    const role = caller && caller.snapshotAttribute('role');

    if (role !== ROLE_ADMINISTRATOR) throw httpError('unauthorized (role=administrator required)', 403);

    const run$ = await exports.effect({ params, deps });

    if (!run$) throw httpError(`query not found (name=${params.name})`, 404);

    return run$;
}
