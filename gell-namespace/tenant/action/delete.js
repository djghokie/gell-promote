const assert = require('assert');

const tenantItems = require('../snapshot/items');

exports.__metadata = {
    name: 'gell.tenant.delete',
    description: 'deletes a TENANT, every item stored under its namespace and its MEMBERs',
    triggers: {
        effect: {
            params: { id: 'string' },
            transaction: 'JOIN'
        }
    }
}

const deleteOperation = ({ type, id }) => ({
    operation: 'explicit',
    command: {
        Delete: {
            Key: { type, id }
        }
    }
});

/**
 * NOTE: hard delete; the TENANT's items and MEMBERs are deleted before the TENANT, in the caller's transaction
 * context.application: the APPLICATION MEMBERs are scoped to (see ../snapshot/items.js)
 *
 * WIP: no action yet (not exposed to the admin UI); the {{ prefix }}-job tenant.delete job is the only caller
 * WIP: a DynamoDB transaction is limited to 100 operations, so large TENANTs can't be deleted in one
 * transaction yet (the mock transaction doesn't delete at all)
 */
exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.tenant.delete")');

    const { id } = params;
    const { $txn } = context;

    assert(id, 'id is required');
    assert($txn, '$txn is required');

    const { tenant$, items$, members$ } = await tenantItems.effect({ params: { id }, context, deps });

    [...items$, ...members$].forEach(item$ => $txn.next(deleteOperation(item$)));
    $txn.next(deleteOperation(tenant$));

    logger.info(`deleting tenant (id=${id}; items=${items$.length}; members=${members$.length})`);

    return { tenant$, items$, members$ };
}
