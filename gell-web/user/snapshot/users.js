const assert = require('assert');
const _ = require('lodash');

const user = require('gell-web/domain/user');

const application = require('../../../gell-namespace/domain/application');
const namespace = require('../../../gell-namespace/snapshot/namespace');

exports.__metadata = {
    name: 'web.users',
    description: 'returns all USERs associated with an application',
    triggers: {
        effect: {},
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

async function doFetch(application_, deps) {
    const { logger, store } = deps.resolve('logger', 'store');

    const parentId = application_.id;

    // console.debug('#####', parentId);

    return store.drain('session.children', { parentId });
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.users")');

    throw new Error('NYI');
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