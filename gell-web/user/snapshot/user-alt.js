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

async function lookupById(id, application, deps) {
    const { logger, store } = deps.resolve('logger', 'store');

    if (application) {
        const { id: namespaceId } = application;

        var type = `${namespaceId}::${user.TYPE}`;
    }
    else var type = user.TYPE;

    logger.info(`looking up user (id=${id}; type=${type})`);

    const user$ = await store.lookup({ type, id });

    if (user$) return user.materialize(user$);
    else
        logger.warn(`no user (id=${id}; type=${type}) found`);
}

async function lookupByUserId(userId, application, deps) {
    const { logger, store } = deps.resolve('logger', 'store');

    if (application) {
        const { id: namespaceId } = application;

        var type = `${namespaceId}::${user.TYPE}`;
    }
    else var type = user.TYPE;

    logger.info(`looking up user (userId=${userId}; type=${type})`);

    const [user$] = await store.drain('web.user.userId', { type, userId });

    if (user$) return user.materialize(user$);
    else
        logger.warn(`no user (userId=${userId}; type=${type}) found`);
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.user.lookup.alt")');

    const { id, userId } = params;
    const { application } = context;

    if (id) return lookupById(id, application, deps);
    
    if (userId) return lookupByUserId(userId, application, deps);

    throw new Error('either id or userId is required');
}

exports.api = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="web.user.lookup.alt")');
    
    const { id, userId } = params;
    const { application } = context;

    if (id) {
        var user_ = await lookupById(id, application, deps);
        if (!user_) throw Object.assign(new Error(`user not found (id=${id})`), { status: 404 });
    }
    else if (userId) {
        var user_ = await lookupByUserId(userId, application, deps);
        if (!user_) throw Object.assign(new Error(`user not found (userId=${userId})`), { status: 404 });
    }
    else throw new Error('either id or userId is required');

    return user_.snapshot();
}
