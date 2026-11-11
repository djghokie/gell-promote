const crypto = require('crypto');

const { templateIdOf } = require('./signwell');

/**
 * In-memory e-signature service for tests - the same interface as ./signwell
 *  - templates: the service's templates, by id, as described ({ id, name, status, archived, editUrl,
 *    placeholders, fields }); defineTemplate(...) adds a finished one, createTemplate a draft
 *  - documents: what was created, by id ({ templateId, name, signer, placeholder, values, metadata, status })
 *  - event(type, id): a webhook payload for document id, signed like SignWell's (see parse)
 *  - calls: every call made, e.g. [['createFromTemplate', id], ['cancel', id]]
 */
const NAME = 'FAKE';

const WEBHOOK_ID = 'fake-webhook';

module.exports = function fake() {
    const templates = {};
    const documents = {};
    const calls = [];
    let sequence = 0;

    function hash(type, time) {
        return crypto.createHmac('sha256', WEBHOOK_ID).update(`${type}@${time}`).digest('hex');
    }

    function error(message, status) {
        const e = new Error(message);
        e.status = status;

        return e;
    }

    return {
        name: NAME,
        testMode: true,
        templateIdOf,
        templates,
        documents,
        calls,

        /**
         * A finished template, ready to sign from: one signer role, a signature field and text fields for apiIds
         */
        defineTemplate({ id=`fake-template-${++sequence}`, name='Agreement', placeholder='Signer', apiIds=[], status='Available', fields }={}) {
            templates[id] = {
                id,
                name,
                status,
                archived: false,
                editUrl: `https://signing.test/edit/template/${id}`,
                placeholders: [{ id: '1', name: placeholder }],
                fields: fields || [
                    ...apiIds.map(apiId => ({ apiId, type: 'text', placeholder })),
                    { apiId: 'Signature_1', type: 'signature', placeholder },
                ],
            };

            return templates[id];
        },

        async createTemplate({ name, filename, file, placeholder='Signer' }) {
            const id = `fake-template-${++sequence}`;

            templates[id] = {
                id,
                name,
                status: 'Created',
                archived: false,
                editUrl: `https://signing.test/edit/template/${id}`,
                placeholders: [{ id: '1', name: placeholder }],
                fields: [],
                filename,
                file,
            };
            calls.push(['createTemplate', id]);

            return templates[id];
        },

        async template(id) {
            calls.push(['template', id]);

            return templates[id] ? { ...templates[id] } : undefined;
        },

        async createFromTemplate({ templateId, name, signer, placeholder, values={}, redirectUrl, metadata={} }) {
            const template = templates[templateId];

            if (!template) throw error(`fake template not found (id=${templateId})`, 502);

            const known = template.fields.map(f => f.apiId);
            const unknown = Object.keys(values).filter(apiId => !known.includes(apiId));
            if (unknown.length > 0) throw error(`fake template has no fields ${unknown.join(', ')}`, 502);

            const id = `fake-document-${++sequence}`;

            documents[id] = { id, templateId, name, signer, placeholder, values, redirectUrl, metadata, status: 'PENDING' };
            calls.push(['createFromTemplate', id]);

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
