const assert = require('assert');
const _ = require('lodash');

const initiate = require('gell-session/event/initiate');
const activate = require('gell-session/event/activate');

const ecosystem = require('gell-promote/gell-namespace/domain/ecosystem');
const tenant = require('gell-promote/gell-namespace/domain/tenant');

exports.__metadata = {
    name: 'namespace.create',
    description: 'creates a NAMESPACE',
    triggers: {
        action: {
            params: {
                name: 'string',
            },
            transaction: 'NEW'
        }
    },
};

/**
 * WIP: copied from gell-promote/gell-session/util/event
 *  - this implementation is meant for stereotypes
 *  - util doesnt work because you need to pin it to a type
 *      - this supports all namespace types
 * 
 * @param {*} type 
 * @param {*} parent$ 
 * @param {*} defaults 
 * @param {*} $txn 
 * @param {*} deps 
 * @returns 
 */
async function doInitiate(type, parent$, defaults, $txn, deps) {
    const types = deps.resolveSingle('types');

    const namespace_ = types.instance(type, {
        ...defaults,
        parentId: parent$.id,
        status: 'ACTIVE'
    });

	if ($txn) $txn.next({ operation: 'put', item: namespace_ });

    await activate.effect({
        context: {
            session_: namespace_,
        },
        deps
    });

// console.debug('#####', namespace_.snapshot());

    return namespace_;
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="namespace.create")');

    // console.debug('#####', context);
    // console.debug('#####', params);

    const { type, parent_ } = context;
    assert(type, 'type is required');
    assert(parent_, 'parent_ is required');

    return doInitiate(type, parent_.snapshotPartial(['id']), params, context.$txn, deps);
}

exports.action = async function({ params={}, context={}, deps }) {
    const { logger, types } = deps.resolve('logger', 'types');

    logger.info('executing action (name="namespace.create")');
    
    const { name } = params;
    const { $txn } = context;

    const tenant_ = types.instance(tenant.TYPE, {
        name,
        status: 'ACTIVE'
    });

    return initiate.effect({
        params: tenant_.snapshot(),
        context: {
            parent_: ecosystem.materialize({ id: "INCUBATOR" }),
            $txn
        },
        deps
    });
}
