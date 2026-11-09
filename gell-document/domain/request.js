const javascript = require('gell-domain/binding/javascript');
const session = require('gell-session/domain/session');

const TYPE = 'DOCUMENT#REQUEST';

/**
 * A request for a signature through an e-signature service (SignWell) - see ../event/request
 *  - parentId/parentType: the record it is signed for (an employee FILE, ...); name: the template name
 *  - title/text/hash/values: exactly what was sent to be signed (rendered from templateId/templateVersion)
 *  - data: application values kept with the signature (e.g. { hourlyRate })
 *  - service/serviceDocumentId: the e-signature service and its id for the document
 *  - signedId: the DOCUMENT#SIGNED written when the service reports the document completed
 *  - at most one PENDING request per parent and name; a new request cancels the older ones
 */
const STATUSES = {
    PENDING: { description: 'sent to the e-signature service, waiting for the signer' },
    COMPLETED: { description: 'signed; the signed copy is a DOCUMENT#SIGNED (signedId)' },
    DECLINED: { description: 'the signer declined to sign' },
    EXPIRED: { description: 'the e-signature service expired the document before it was signed' },
    CANCELED: { description: 'cancelled before it was signed (a newer request, or by the application)' },
};

const model = {
    name: TYPE,
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        status: {
            type: 'string',
            default: 'PENDING'
        },
        name: 'string',
        parentType: 'string',
        templateId: 'string',
        templateVersion: 'number',
        title: 'string',
        text: 'text',
        hash: {
            type: 'string',
            description: 'SHA-256 of the title and text sent (../lib/signature)'
        },
        values: 'object',
        data: 'object',
        signer: {
            type: 'complex',
            attributes: ['name', 'email']
        },
        service: 'string',
        serviceDocumentId: 'string',
        signedId: 'string',
        completedTs: 'timestamp',
        closedTs: 'timestamp',
        reason: {
            type: 'string',
            description: 'why a request was cancelled, declined or expired'
        },
    },

    workflow: {
        statuses: STATUSES
    }
}

module.exports = {
    TYPE,
    STATUSES,
    model,
    materialize: session$ => javascript.materialize(session$, model)
}
