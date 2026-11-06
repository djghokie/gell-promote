const assert = require('assert');
const _ = require('lodash');

const user = require('gell-web/domain/user');

const application = require('../../../gell-namespace/domain/application');
const namespace = require('../../../gell-namespace/snapshot/namespace');

exports.__metadata = {
    name: 'web.users',
    description: 'returns all USERs associated with an application',
    triggers: {
        effect: {
            context: {
                application_: 'state'
            }
        },
        api: {
            params: {
                applicationId: {
                    type: 'string',
                    optional: true
                }
            }
        }
    }
}

/**
 * NOTE: USERs are namespaced by their APPLICATION
 * 
 * @param {*} application_ 
 * @param {*} deps 
 * @returns 
 */
async function doFetch(application_, deps) {
    const { logger, store } = deps.resolve('logger', 'store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    const parentId = application_.id;
    const userType = types ? types.name(user.TYPE, parentId) : user.TYPE;

    logger.info(`fetching users (type=${userType}; parentId=${parentId})`);

// console.debug('#####', store.snapshot());

    // console.debug('#####', parentId);

    return store.drain('session.children', { type: userType, parentId });
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.users")');

    const { application_ } = context;
    assert(application_, 'application_ is required');

    return doFetch(application_, deps);
}

exports.api = async function({ caller, params={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');

    logger.info('executing api (name="web.users")');

    if (params.applicationId) {
        var application_ = await namespace.effect({
            params: {
                type: application.TYPE,
                id: params.applicationId
            },
            deps
        });
    } else {
        const parentId = caller.snapshotAttribute('parentId');
        if (parentId) {
            /**
             * NOTE: this assumes namespaceId references an application
             */
            var application_ = await namespace.effect({
                params: {
                    type: application.TYPE,
                    id: parentId
                },
                deps
            });
        }
        else return store.drain('sessions.active.type', user.TYPE);
    }

    return doFetch(application_, deps);
}