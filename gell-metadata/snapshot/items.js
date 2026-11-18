const assert = require('assert');

exports.__metadata = {
    name: 'gell.domain.type.items',
    description: 'returns all items of a registered domain TYPE',
    triggers: {
        effect: {
            params: {
                name: 'string',
                namespace: { type: 'string', optional: true }
            }
        },
        api: {
            params: {
                name: 'string',
                namespace: { type: 'string', optional: true }
            }
        }
    }
}

/**
 * NOTE: items are stored under the namespaced type (types.name); an explicit namespace param overrides the
 * registry's namespace (e.g. TEST::<REALM>#NOTE)
 *
 * WIP: reads every item of the TYPE in one drain; page it once a TYPE has many items
 */
exports.effect = async function({ params={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    logger.info('executing effect (name="gell.domain.type.items")');

    const { name, namespace } = params;

    assert(name, 'name is required');

    // NOTE: without the types registry no TYPE is registered (reported as a 404)
    if (!types || !types.get(name)) return;

    const type = namespace ? `${namespace}${types.delimeter}${name}` : types.name(name);

    return store.drain('sessions.activity.type', { type });
}

/**
 * NOTE: gell-http's api wrapper crashes on an empty result, so a missing TYPE is reported as a 404 instead
 */
exports.api = async function({ params={}, deps }) {
    const items$ = await exports.effect({ params, deps });

    if (!items$) throw Object.assign(new Error(`type not found (name=${params.name})`), { status: 404 });

    return items$;
}
