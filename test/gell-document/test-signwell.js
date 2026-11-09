const assert = require('assert');
const crypto = require('crypto');

const { PDFDocument } = require('pdf-lib');

const pdf = require('../../gell-document/lib/pdf');
const signwell = require('../../gell-document/service/signwell');

const WEBHOOK_ID = 'webhook-123';

function event(type, object={}, key=WEBHOOK_ID) {
    const time = 1700000000;
    const hash = crypto.createHmac('sha256', key).update(`${type}@${time}`).digest('hex');

    return { event: { type, time, hash }, data: { object } };
}

// a fetch that records requests and answers with the given responses, in order
function fakeFetch(...responses) {
    const requests = [];

    const fetch = async (url, options={}) => {
        requests.push({ url, ...options, body: options.body && JSON.parse(options.body) });

        const { status=200, json={}, bytes } = responses.shift() || {};

        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => json,
            text: async () => JSON.stringify(json),
            arrayBuffer: async () => (bytes || Buffer.from('')).buffer,
        };
    };

    return { fetch, requests };
}

describe('gell-document pdf', function() {
    it('renders a PDF with a signature and date field', async function() {
        const { bytes, fields } = await pdf.render({ title: 'Agreement', text: 'Hello Dee.\n\nYou earn $25.00 per hour.', signerName: 'Dee Driver' });

        assert.strictEqual(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-');
        assert.deepStrictEqual(fields.map(f => f.type), ['signature', 'date']);
        assert.ok(fields.every(f => f.page === 1 && f.x >= 0 && f.y >= 0));
    })

    it('puts the signature block on a new page when the text fills the page', async function() {
        const text = Array.from({ length: 80 }, (_, i) => `Paragraph ${i + 1} of a long agreement.`).join('\n\n');

        const { bytes, fields } = await pdf.render({ title: 'Agreement', text, signerName: 'Dee Driver' });
        const document = await PDFDocument.load(bytes);

        assert.ok(document.getPageCount() > 1);
        assert.strictEqual(fields[0].page, document.getPageCount());
    })

    it('draws characters the standard fonts cannot encode', async function() {
        const { bytes } = await pdf.render({ title: 'Agreement – “v2”', text: 'Pay… ✓ 🚐', signerName: 'Dee' });

        assert.ok(bytes.length > 0);
    })
})

describe('gell-document signwell', function() {
    describe('parse', function() {
        const service = signwell({ apiKey: 'key', webhookId: WEBHOOK_ID });

        it('maps a completed document to COMPLETED with the request id', function() {
            const result = service.parse(event('document_completed', { id: 'doc-1', test_mode: true, metadata: { requestId: 'req-1' } }));

            assert.deepStrictEqual(result, {
                status: 'COMPLETED',
                type: 'document_completed',
                serviceDocumentId: 'doc-1',
                requestId: 'req-1',
                testMode: true,
                reason: undefined,
            });
        })

        it('maps declined, expired and canceled documents', function() {
            assert.strictEqual(service.parse(event('document_declined', { decline_reason: 'no' })).status, 'DECLINED');
            assert.strictEqual(service.parse(event('document_declined', { decline_reason: 'no' })).reason, 'no');
            assert.strictEqual(service.parse(event('document_expired')).status, 'EXPIRED');
            assert.strictEqual(service.parse(event('document_canceled')).status, 'CANCELED');
        })

        it('has no status for other events', function() {
            assert.strictEqual(service.parse(event('document_viewed')).status, undefined);
        })

        it('refuses an event signed with another key', function() {
            assert.throws(() => service.parse(event('document_completed', {}, 'someone-else')), e => e.status === 401);
        })

        it('refuses an event without a hash', function() {
            assert.throws(() => service.parse({ event: { type: 'document_completed', time: 1 }, data: {} }), e => e.status === 401);
        })
    })

    describe('create', function() {
        it('posts the PDF, the signer and the fields for embedded signing', async function() {
            const { fetch, requests } = fakeFetch({ json: { id: 'doc-1', recipients: [{ id: '1', embedded_signing_url: 'https://sign/doc-1' }] } });
            const service = signwell({ apiKey: 'key', webhookId: WEBHOOK_ID, fetch });

            const result = await service.create({
                name: 'Agreement',
                pdf: Buffer.from('%PDF-1.7'),
                signer: { name: 'Dee Driver', email: 'dee@example.com' },
                fields: [{ type: 'signature', page: 1, x: 72.4, y: 500, width: 220, height: 40 }],
                redirectUrl: 'https://ops/back',
                metadata: { requestId: 'req-1' },
            });

            const [request] = requests;

            assert.deepStrictEqual(result, { id: 'doc-1', signingUrl: 'https://sign/doc-1' });
            assert.strictEqual(request.method, 'POST');
            assert.ok(request.url.endsWith('/api/v1/documents'));
            assert.strictEqual(request.headers['X-Api-Key'], 'key');
            assert.strictEqual(request.body.test_mode, true, 'test mode unless turned off');
            assert.strictEqual(request.body.embedded_signing, true);
            assert.strictEqual(request.body.recipients[0].send_email, false);
            assert.strictEqual(request.body.fields[0][0].x, 72);
            assert.strictEqual(request.body.fields[0][0].recipient_id, '1');
            assert.deepStrictEqual(request.body.metadata, { requestId: 'req-1' });
            assert.strictEqual(Buffer.from(request.body.files[0].file_base64, 'base64').toString(), '%PDF-1.7');
        })

        it('reports an API error as a bad gateway with the service status', async function() {
            const { fetch } = fakeFetch({ status: 422, json: { errors: { files: ['bad'] } } });
            const service = signwell({ apiKey: 'key', webhookId: WEBHOOK_ID, fetch });

            await assert.rejects(service.create({ name: 'x', pdf: Buffer.from(''), signer: {}, fields: [] }), e => e.status === 502 && /status=422/.test(e.message));
        })
    })

    describe('cancel', function() {
        it('treats a document that is already gone as cancelled', async function() {
            const { fetch, requests } = fakeFetch({ status: 404 });
            const service = signwell({ apiKey: 'key', webhookId: WEBHOOK_ID, fetch });

            await service.cancel('doc-1');

            assert.strictEqual(requests[0].method, 'DELETE');
        })
    })
})
