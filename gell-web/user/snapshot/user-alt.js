const assert = require('assert');
const _ = require('lodash');

const user = require('gell-web/domain/user');

exports.__metadata = {
    name: 'web.user.lookup.alt',
    description: 'find user by id or userId',
    triggers: {
        effect: {},
        api: {
            params: {
                id: {
                    type: 'uuid',
                    optional: true
                },
                userId: {
                    type: 'uuid',
                    optional: true
                },
            }
        }
    }
}

async function lookupById(id, deps) {
    const { logger, store } = deps.resolve('logger', 'store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    const type = types ? types.name(user.TYPE) : user.TYPE;

    logger.info(`looking up user (id=${id}; type=${type})`);

    const user$ = await store.lookup({ type, id });

    if (user$) return user.materialize(user$);
    else
        logger.warn(`no user (id=${id}; type=${type}) found`);
}

async function lookupByUserId(userId, application, deps) {
    const { logger, store } = deps.resolve('logger', 'store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    const type = types ? types.name(user.TYPE) : user.TYPE;

    const applicationId = application.id;

    logger.info(`looking up user (userId=${userId}; type=${type})`);

    const [user$] = await store.drain('web.user.userId', { type, userId, applicationId });

    if (user$) return user.materialize(user$);
    else
        logger.warn(`no user (userId=${userId}; type=${type}) found`);
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.user.lookup.alt")');

    const { id, userId } = params;

    if (id) return lookupById(id, deps);
    
    if (userId) return lookupByUserId(userId, context.application, deps);

    throw new Error('either id or userId is required');
}

exports.api = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="web.user.lookup.alt")');
    
    const { id, userId } = params;

    if (id) {
        var user_ = await lookupById(id, deps);
        if (!user_) throw Object.assign(new Error(`user not found (id=${id})`), { status: 404 });
    }
    else if (userId) {
        var user_ = await lookupByUserId(userId, deps);
        if (!user_) throw Object.assign(new Error(`user not found (userId=${userId})`), { status: 404 });
    }
    else throw new Error('either id or userId is required');

    return user_.snapshot();
}
