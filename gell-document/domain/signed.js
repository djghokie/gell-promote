const javascript = require('gell-domain/binding/javascript');
const session = require('gell-session/domain/session');

const TYPE = 'DOCUMENT#SIGNED';

/**
 * A document as it was signed - immutable once saved
 *  - parentId/parentType: the record it was signed for (an employee FILE, a CONTRACT, ...)
 *  - name: what the document is (see ./template); templateId: the DOCUMENT#TEMPLATE it was signed from;
 *    title: the template's title at the time; values: the merge field values filled in
 *  - data: application values to keep with the signature (e.g. { hourlyRate })
 *  - signed through an e-signature service (../event/request): service/serviceDocumentId/requestId, and the
 *    service's completed PDF (with its audit page) in documentStorage at pdfKey, with its SHA-256 in pdfHash -
 *    the PDF is the record of what was signed
 *  - NOTE: copies signed by typed name, before templates moved to the e-signature service, have no PDF: they
 *    keep templateVersion, the rendered text, and signature.hash (SHA-256 of title and text, ../lib/signature)
 */
const STATUSES = {
    SIGNED: { description: 'signed' },
    SUPERSEDED: { description: 'signed after its request was cancelled - kept, but not the current signature' },
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
            default: 'SIGNED'
        },
        name: 'string',
        parentType: 'string',
        templateId: 'string',
        templateVersion: 'number',
        title: 'string',
        text: 'text',
        values: {
            type: 'object',
            description: 'the merge field values filled in'
        },
        data: {
            type: 'object',
            description: 'application values kept with the signature, e.g. { hourlyRate }'
        },
        signature: {
            type: 'complex',
            attributes: ['name', 'signedTs', 'hash']
        },
        signedTs: 'timestamp',
        service: 'string',
        serviceDocumentId: 'string',
        requestId: 'string',
        pdfKey: {
            type: 'string',
            description: 'documentStorage key of the signed PDF (with the audit page)'
        },
        pdfHash: {
            type: 'string',
            description: 'SHA-256 (hex) of the signed PDF as downloaded'
        },
        purgedOn: {
            type: 'string',
            description: 'YYYY-MM-DD the signed PDF was deleted (here and at the service) with its parent record (document.purge)'
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
