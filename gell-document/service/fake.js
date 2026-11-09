const crypto = require('crypto');

/**
 * In-memory e-signature service for tests - the same interface as ./signwell
 *  - documents: what was created, by id ({ name, pdf, signer, fields, metadata, status })
 *  - event(type, id): a webhook payload for document id, signed like SignWell's (see parse)
 *  - calls: every call made, e.g. [['create', id], ['cancel', id]]
 */
const NAME = 'FAKE';

const WEBHOOK_ID = 'fake-webhook';

module.exports = function fake() {
    const documents = {};
    const calls = [];
    let sequence = 0;

    function hash(type, time) {
        return crypto.createHmac('sha256', WEBHOOK_ID).update(`${type}@${time}`).digest('hex');
    }

    return {
        name: NAME,
        testMode: true,
        documents,
        calls,

        async create({ name, pdf, signer, fields, redirectUrl, metadata={} }) {
            const id = `fake-document-${++sequence}`;

            documents[id] = { id, name, pdf, signer, fields, redirectUrl, metadata, status: 'PENDING' };
            calls.push(['create', id]);

            return { id, signingUrl: `https://signing.test/${id}` };
        },

        async signingUrl(id) {
            calls.push(['signingUrl', id]);

            return `https://signing.test/${id}?at=${Date.now()}`;
        },

        async cancel(id) {
            calls.push(['cancel', id]);
            if (documents[id]) documents[id].status = 'CANCELED';
        },

        async download(id) {
            calls.push(['download', id]);

            return new Uint8Array(Buffer.from(`%PDF-1.7 signed copy of ${id}`));
        },

        async remove(id) {
            calls.push(['remove', id]);
            delete documents[id];
        },

        event(type, id, { hash: forged, reason }={}) {
            const time = Math.floor(Date.now() / 1000);
            const document = documents[id] || { id, metadata: {} };

            return {
                event: { type, time, hash: forged || hash(type, time) },
                data: { object: { id, metadata: document.metadata, test_mode: true, ...(reason ? { decline_reason: reason } : {}) } },
            };
        },

        parse(payload={}) {
            const { event={}, data={} } = payload;

            if (event.hash !== hash(event.type, event.time)) {
                const e = new Error('fake event did not verify');
                e.status = 401;
                throw e;
            }

            const object = data.object || {};
            const status = {
                document_completed: 'COMPLETED',
                document_declined: 'DECLINED',
                document_expired: 'EXPIRED',
                document_canceled: 'CANCELED',
            }[event.type];

            return {
                status,
                type: event.type,
                serviceDocumentId: object.id,
                requestId: object.metadata && object.metadata.requestId,
                testMode: true,
                reason: object.decline_reason,
            };
        },
    };
}

module.exports.NAME = NAME;
