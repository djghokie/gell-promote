const lookup = require('gell-session/snapshot/lookup');

const request = require('../domain/request');

const CLOSED = ['DECLINED', 'EXPIRED', 'CANCELED'];

/**
 * Records a signature request the e-signature service reports declined, expired or cancelled (from ./webhook)
 *  - params: { id: the DOCUMENT#REQUEST, status: DECLINED | EXPIRED | CANCELED, reason (optional) }
 *  - only a PENDING request changes; anything else (already closed, completed) is left as it is
 *  - returns the request state
 */
exports.__metadata = {
    name: 'document.request.close',
    description: 'records a signature request that ended without a signature',
    triggers: {
        effect: {
            params: {
                id: 'uuid',
                status: 'string',
                reason: { type: 'string', optional: true },
            },
            context: {
                $txn: 'state'
            }
        }
    }
}

exports.CLOSED = CLOSED;

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');
    const { $txn } = context;

    logger.info('executing effect (name="document.request.close")');

    const { id, status, reason } = params;

    if (!CLOSED.includes(status)) throw new Error(`not a closed status (status=${status})`);

    const request_ = await lookup.effect({
        params: { key: { type: request.TYPE, id } },
        context: { materialize: request.materialize },
        deps
    });

    if (!request_ || request_.snapshotAttribute('status') !== 'PENDING') return request_;

    request_.set('status', status);
    request_.set('closedTs', Date.now());
    if (reason) request_.set('reason', reason);

    $txn.next({ operation: 'put', item: request_ });

    logger.info(`signature request closed (id=${id}; status=${status})`);

    return request_;
}
