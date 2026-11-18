const request = require('../domain/request');
const signed = require('../domain/signed');

/**
 * Deletes what the e-signature service holds for a record whose retention period has passed
 *  - context.parent_: the record (a State, or a { type, id } key); context.$txn
 *  - params.asOf: YYYY-MM-DD, recorded as purgedOn
 *  - every signed PDF is deleted from documentStorage, and the service is asked to delete its copy of every
 *    document (signed or not); then, in $txn, each DOCUMENT#SIGNED loses its pdfKey and each DOCUMENT#REQUEST
 *    its signer, and both get purgedOn
 *  - the signed text, version and signature hash stay: the record of what was signed is kept
 *  - the deletes happen before the transaction commits: if it fails, a rerun deletes again (missing is fine)
 *  - documents created with another service (e.g. FAKE in a test environment) are not sent to this one
 *  - returns { pdfs: deleted PDFs, removed: documents deleted at the service }
 *
 * NOTE: SignWell's DELETE /documents/{id} removes the document from the account; whether SignWell keeps
 *       anything afterwards (backups, audit logs) is to be confirmed with SignWell (sc-525)
 */
exports.__metadata = {
    name: 'document.purge',
    description: 'deletes the signed PDFs of a record and the service copies of its documents',
    triggers: {
        effect: {
            params: {
                asOf: 'string',
            },
            context: {
                parent_: 'state',
                $txn: 'state'
            }
        }
    }
}

function idOf(record) {
    return typeof record.snapshotAttribute === 'function' ? record.snapshotAttribute('id') : record.id;
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');

    logger.info('executing effect (name="document.purge")');

    const { asOf } = params;
    const { parent_, $txn } = context;

    const parentId = idOf(parent_);

    const [signed$, requests$] = await Promise.all([
        store.drain('session.children', { type: signed.TYPE, parentId }),
        store.drain('session.children', { type: request.TYPE, parentId }),
    ]);

    const pdfs$ = signed$.filter(s$ => s$.pdfKey);

    if (pdfs$.length) {
        const documentStorage = deps.resolveSingle('documentStorage');
        for (const signed$ of pdfs$) await documentStorage.remove(signed$.pdfKey);
    }

    // the service's copies - a request and the document signed from it share serviceDocumentId
    const atService = [...signed$, ...requests$].filter(d$ => d$.serviceDocumentId && !d$.purgedOn);
    const serviceDocuments = [...new Map(atService.map(d$ => [d$.serviceDocumentId, d$.service])).entries()];

    let removed = 0;
    if (serviceDocuments.length) {
        const signing = deps.resolveSingle('signing');

        for (const [serviceDocumentId, service] of serviceDocuments) {
            if (service && service !== signing.name) {
                logger.warn(`not removing a document created with another service (serviceDocumentId=${serviceDocumentId}; service=${service}; signing=${signing.name})`);
                continue;
            }

            await signing.remove(serviceDocumentId);
            removed++;
        }
    }

    // NOTE: one put per item
    signed$.filter(s$ => s$.service && !s$.purgedOn).forEach(s$ => {
        const signed_ = signed.materialize(s$);
        signed_.remove('pdfKey');
        signed_.set('purgedOn', asOf);
        $txn.next({ operation: 'put', item: signed_ });
    });

    requests$.filter(r$ => !r$.purgedOn).forEach(r$ => {
        const request_ = request.materialize(r$);
        request_.remove('signer');
        // deleted at the service: its link no longer works
        if (r$.status === 'PENDING') {
            request_.set('status', 'CANCELED');
            request_.set('closedTs', Date.now());
            request_.set('reason', 'PURGED');
        }
        request_.set('purgedOn', asOf);
        $txn.next({ operation: 'put', item: request_ });
    });

    logger.info(`purged signed documents (parentId=${parentId}; pdfs=${pdfs$.length}; removed=${removed})`);

    return { pdfs: pdfs$.length, removed };
}
