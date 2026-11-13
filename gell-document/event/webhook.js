const lookup = require('gell-session/snapshot/lookup');

const request = require('../domain/request');
const hook = require('../lib/hooks');
const close = require('./close');
const complete = require('./complete');

/**
 * Receives an event from the e-signature service (SignWell webhook) and updates the signature request
 *  - public: the service is the caller; the event is verified by the `signing` dependency (parse), which throws
 *    a 401 error when it doesn't verify
 *  - params: the event as posted ({ event, data } for SignWell)
 *  - completed (everyone signed) -> ./complete; declined / expired / cancelled -> ./close
 *  - signed (one recipient): when it is the signer of a request with cosigners, records signerSignedTs (the
 *    request stays PENDING) and runs the application's signerSigned hook, with context { request_, $txn } - so
 *    the application can tell the cosigners it's their turn; a cosigner signing is left to the completed event
 *  - other events are ignored
 *  - the request is found by the requestId the document was created with (metadata); events for documents
 *    that aren't ours, or from test mode while the service is live (and the reverse), are ignored
 *  - returns { ignored } or { id, status }
 */
exports.__metadata = {
    name: 'document.request.webhook',
    description: 'records what the e-signature service reports about a signature request',
    triggers: {
        action: {
            params: {
                event: 'object',
                data: 'object',
            },
            transaction: 'NEW',
            public: true
        }
    }
}

async function signerSigned(request_, event, { $txn, deps }) {
    const { logger } = deps.resolve('logger');
    const request$ = request_.snapshotPartial(['id', 'name', 'status', 'signer', 'cosigners', 'signerSignedTs']);
    const signer = String((request$.signer || {}).email || '').toLowerCase();

    if (request$.status !== 'PENDING' || !(request$.cosigners || []).length || request$.signerSignedTs || String(event.signerEmail || '').toLowerCase() !== signer) {
        logger.info(`ignoring e-signature event (type=${event.type}; id=${request$.id}; status=${request$.status})`);
        return { ignored: event.type };
    }

    request_.set('signerSignedTs', Date.now());
    $txn.next({ operation: 'put', item: request_ });

    logger.info(`signer signed, waiting for the cosigners (id=${request$.id})`);

    const handler = hook(request$.name, 'signerSigned', deps);

    if (handler && handler.effect) await handler.effect({ context: { request_, $txn }, deps });

    return { id: request$.id, status: event.status };
}

exports.action = async function({ params={}, context={}, deps }) {
    const { logger, signing } = deps.resolve('logger', 'signing');
    const { $txn } = context;

    logger.info('executing action (name="document.request.webhook")');

    const event = signing.parse(params);

    if (!event.status) {
        logger.info(`ignoring e-signature event (type=${event.type})`);
        return { ignored: event.type };
    }

    if (event.testMode !== !!signing.testMode) {
        logger.warn(`ignoring e-signature event from the other mode (type=${event.type}; testMode=${event.testMode})`);
        return { ignored: event.type };
    }

    const request_ = event.requestId && await lookup.effect({
        params: { key: { type: request.TYPE, id: event.requestId } },
        context: { materialize: request.materialize },
        deps
    });

    if (!request_ || request_.snapshotAttribute('serviceDocumentId') !== event.serviceDocumentId) {
        logger.warn(`ignoring e-signature event for an unknown document (type=${event.type}; serviceDocumentId=${event.serviceDocumentId}; requestId=${event.requestId})`);
        return { ignored: event.type };
    }

    const id = request_.snapshotAttribute('id');

    if (event.status === 'SIGNED') return signerSigned(request_, event, { $txn, deps });

    if (event.status === 'COMPLETED') {
        await complete.effect({ params: { id }, context: { $txn }, deps });
    } else {
        await close.effect({ params: { id, status: event.status, reason: event.reason }, context: { $txn }, deps });
    }

    return { id, status: event.status };
}
