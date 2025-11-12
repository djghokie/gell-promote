const assert = require('assert');
const _ = require('lodash');

const identity = require('gell-web/identity/domain/identity');

const activate = require('gell-session/event/activate');

exports.__metadata = {
    name: 'web.identity.add',
    description: 'adds a new WEB#IDENTITY',
    triggers: {
        effect: {
            params: {
                id: 'string'
            },
        },
        action: {
            params: {
                id: 'string'
            },
            transaction: 'NEW'
        }
    }
}

async function doAdd(id, $txn, deps) {
    const identity_ = identity.materialize({
        id
    });

    if ($txn) $txn.next({ operation: 'put', item: identity_ })

    await activate.effect({
        context: {
            session_: identity_
        },
        deps
    });

    return identity_;
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="identity.add")');

    const { id } = params;
    const { $txn } = context;

    return doAdd(id, $txn, deps);
}

exports.action = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing action (name="identity.add")');

    const { id } = params;
    const { $txn } = context;

    return doAdd(id, $txn, deps);
}