const lookup = require('gell-session/snapshot/lookup');

const request = require('../domain/request');
const close = require('./close');
const complete = require('./complete');

/**
 * Receives an event from the e-signature service (SignWell webhook) and updates the signature request
 *  - public: the service is the caller; the event is verified by the `signing` dependency (parse), which throws
 *    a 401 error when it doesn't verify
 *  - params: the event as posted ({ event, data } for SignWell)
 *  - completed -> ./complete; declined / expired / cancelled -> ./close; other events are ignored
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

    if (event.status === 'COMPLETED') {
        await complete.effect({ params: { id }, context: { $txn }, deps });
    } else {
        await close.effect({ params: { id, status: event.status, reason: event.reason }, context: { $txn }, deps });
    }

    return { id, status: event.status };
}
