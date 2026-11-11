const assert = require('assert');
const _ = require('lodash');

const create = require('gell-promote/gell-namespace/action/create');
const tenant = require('gell-promote/gell-namespace/domain/tenant');

exports.__metadata = {
    name: 'namespace.tenant.create',
    description: 'creates a new TENANT',
    triggers: {
        action: {
            params: {
                name: 'string',
                id: {
                    type: 'string',
                    optional: true
                }
            },
            transaction: 'NEW'
        }
    }
}

function doCreate(params, ecosystem_, $txn, deps) {
    return create.effect({
        params,
        context: {
            parent_: ecosystem_,
            type: tenant.TYPE,
            $txn
        },
        deps
    });
}

/**
 * WIP: for now, assuming middleware populates ecosystem
 */
exports.action = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing action (name="tenant.create")');

    const { ecosystem_, $txn } = context;

    return doCreate(params, ecosystem_, $txn, deps);
}
