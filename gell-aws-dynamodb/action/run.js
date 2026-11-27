const assert = require('assert');

// WIP: the administrator role name is a gell-web/gell-auth convention; make it configurable if a project differs
const ROLE_ADMINISTRATOR = 'administrator';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

exports.__metadata = {
    name: 'store.query.run',
    description: 'runs a registered named query with arguments, returning at most limit items',
    triggers: {
        effect: {
            params: {
                name: 'string',
                args: { type: 'object', optional: true },
                limit: { type: 'number', optional: true, validate: { min: 1, max: MAX_LIMIT } }
            }
        },
        api: {
            params: {
                name: 'string',
                args: { type: 'object', optional: true },
                limit: { type: 'number', optional: true, validate: { min: 1, max: MAX_LIMIT } }
            }
        }
    }
}

/**
 * NOTE: a POST body carries args as an object; a GET passes them as a JSON query string parameter
 */
function parseArgs(args) {
    if (typeof args !== 'string') return args;

    try {
        return JSON.parse(args);
    } catch {
        throw Object.assign(new Error(`args must be JSON (args=${args})`), { status: 400 });
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
            if (!optional) throw Object.assign(new Error(`query (name=${query$.name}) missing required parameter (name=${name})`), { status: 400 });

            return;
        }

        if ((type === 'number' || type === 'timestamp') && typeof val === 'string') {
            val = Number(val);

            if (Number.isNaN(val)) throw Object.assign(new Error(`query (name=${query$.name}) parameter (name=${name}) must be a number`), { status: 400 });
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
    const { logger, store } = deps.resolve('logger', 'store');

    const { name, args={}, limit=DEFAULT_LIMIT } = params;

    logger.info(`executing effect (name="store.query.run"; query=${name})`);

    assert(name, 'name is required');

    const query$ = store.queries.describe(name);

    if (!query$) return;

    // NOTE: the dispatch bus rejects a limit outside 1..MAX_LIMIT (params' validate); clamping still guards direct calls
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

    if (role !== ROLE_ADMINISTRATOR) throw Object.assign(new Error('unauthorized (role=administrator required)'), { status: 403 });

    const run$ = await exports.effect({ params, deps });

    if (!run$) throw Object.assign(new Error(`query not found (name=${params.name})`), { status: 404 });

    return run$;
}
