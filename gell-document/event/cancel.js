const requests = require('../snapshot/requests');

/**
 * Cancels the PENDING signature requests for a record (e.g. the terms they were sent with changed)
 *  - params.name: the template name; params.reason (optional): why
 *  - context.parent_: the record (a State, or a { type, id } key); context.$txn
 *  - each request is cancelled at the e-signature service too, so its signing link stops working
 *  - returns the cancelled request states
 *
 * WIP: the service is told before the transaction commits - if the transaction then fails the request stays
 *      PENDING here but is cancelled at the service; a new request replaces it the next time one is made
 */
exports.__metadata = {
    name: 'document.request.cancel',
    description: 'cancels the pending signature requests for a record',
    triggers: {
        effect: {
            params: {
                name: 'string',
                reason: { type: 'string', optional: true },
            },
            context: {
                parent_: 'state',
                $txn: 'state'
            }
        }
    }
}

/**
 * Cancels one request (at the service, then here) - shared with ./request
 */
async function cancelRequest(request_, reason, $txn, deps) {
    const { logger, signing } = deps.resolve('logger', 'signing');

    const { id, serviceDocumentId } = request_.snapshotPartial(['id', 'serviceDocumentId']);

    if (serviceDocumentId) await signing.cancel(serviceDocumentId);

    request_.set('status', 'CANCELED');
    request_.set('closedTs', Date.now());
    if (reason) request_.set('reason', reason);

    $txn.next({ operation: 'put', item: request_ });

    logger.info(`cancelled signature request (id=${id}; serviceDocumentId=${serviceDocumentId}; reason=${reason})`);

    return request_;
}

exports.cancelRequest = cancelRequest;

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="document.request.cancel")');

    const { name, reason } = params;
    const { parent_, $txn } = context;

    const pending_ = (await requests.effect({ params: { name }, context: { parent_ }, deps }))
        .filter(r_ => r_.snapshotAttribute('status') === 'PENDING');

    const cancelled_ = [];
    for (const request_ of pending_) cancelled_.push(await cancelRequest(request_, reason, $txn, deps));

    return cancelled_;
}
