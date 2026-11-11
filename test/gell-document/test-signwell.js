const assert = require('assert');
const crypto = require('crypto');

const { check } = require('../../gell-document/event/refresh');
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

describe('gell-document template check', function() {
    const ready = {
        id: 't-1',
        status: 'Available',
        archived: false,
        placeholders: [{ id: '1', name: 'Employee' }],
        fields: [{ apiId: 'fullName', type: 'text' }, { apiId: 'Signature_1', type: 'signature' }],
    };

    it('finds nothing wrong with a finished template with one signer and a signature field', function() {
        assert.deepStrictEqual(check(ready), []);
    })

    it('reports a template the service no longer has', function() {
        assert.match(check(undefined)[0], /not found/);
    })

    it('reports a draft, an archived template, signer roles and a missing signature field', function() {
        const problems = check({ ...ready, status: 'Created', archived: true, placeholders: [], fields: [] });

        assert.strictEqual(problems.length, 4);
        assert.ok(problems.some(p => /draft/.test(p)));
        assert.ok(problems.some(p => /archived/.test(p)));
        assert.ok(problems.some(p => /exactly one signer role left open .*\(it has 0\)/.test(p)));
        assert.ok(problems.some(p => /signature field/.test(p)));
    })

    describe('with a counter-signer', function() {
        const company = { id: '2', name: 'Company', assigned: { name: 'Owner', email: 'owner@example.com' } };
        const cosigned = {
            ...ready,
            placeholders: [...ready.placeholders, company],
            fields: [
                { apiId: 'fullName', type: 'text', placeholder: 'Employee' },
                { apiId: 'Signature_1', type: 'signature', placeholder: 'Employee' },
                { apiId: 'Signature_2', type: 'signature', placeholder: 'Company' },
            ],
        };

        it('accepts one open role and a preassigned role, each with a signature field', function() {
            assert.deepStrictEqual(check(cosigned), []);
        })

        it('reports a role without a signature field', function() {
            const problems = check({ ...cosigned, fields: cosigned.fields.slice(0, 2) });

            assert.deepStrictEqual(problems, ['has no signature field for Company']);
        })

        it('reports two open roles', function() {
            const problems = check({ ...cosigned, placeholders: [ready.placeholders[0], { id: '2', name: 'Company' }] });

            assert.ok(problems.some(p => /exactly one signer role left open .*\(it has 2\)/.test(p)));
        })

        it('reports no open role', function() {
            const problems = check({ ...cosigned, placeholders: [{ ...ready.placeholders[0], assigned: { name: 'X', email: 'x@example.com' } }, company] });

            assert.ok(problems.some(p => /\(it has 0\)/.test(p)));
        })
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
                signerEmail: undefined,
            });
        })

        it('maps one recipient signing to SIGNED with who signed', function() {
            const payload = event('document_signed', { id: 'doc-1', metadata: { requestId: 'req-1' } });
            payload.event.related_signer = { email: 'dee@example.com', name: 'Dee Driver' };

            const result = service.parse(payload);

            assert.strictEqual(result.status, 'SIGNED');
            assert.strictEqual(result.signerEmail, 'dee@example.com');
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

    describe('templateIdOf', function() {
        const ID = 'a6d987c8-4a02-4ef6-9672-b5a886bc9168';

        it('takes an id as given', function() {
            assert.strictEqual(signwell.templateIdOf(`  ${ID} `), ID);
        })

        it('reads the id from an edit link', function() {
            assert.strictEqual(signwell.templateIdOf(`https://www.signwell.com/edit/template/${ID.toUpperCase()}/`), ID);
            assert.strictEqual(signwell.templateIdOf(`https://www.signwell.com/templates/${ID}?tab=fields`), ID);
        })

        it('finds no id in a link without one', function() {
            assert.strictEqual(signwell.templateIdOf('https://www.signwell.com/new_doc/CBnxWrg8U3GVJVIx/'), undefined);
            assert.strictEqual(signwell.templateIdOf('https://'), undefined);
            assert.strictEqual(signwell.templateIdOf(''), undefined);
        })
    })

    describe('createTemplate', function() {
        it('posts the file as a draft with one signer role', async function() {
            const { fetch, requests } = fakeFetch({ status: 201, json: { id: 't-1', name: 'Agreement', status: 'Created', embedded_edit_url: 'https://www.signwell.com/edit/template/t-1/', placeholders: [{ id: '1', name: 'Employee' }], fields: [] } });
            const service = signwell({ apiKey: 'key', webhookId: WEBHOOK_ID, fetch });

            const result = await service.createTemplate({ name: 'Agreement', filename: 'agreement.docx', file: Buffer.from('word'), placeholder: 'Employee' });

            const [request] = requests;

            assert.strictEqual(request.method, 'POST');
            assert.ok(request.url.endsWith('/api/v1/document_templates'));
            assert.strictEqual(request.body.draft, true);
            assert.deepStrictEqual(request.body.placeholders, [{ id: '1', name: 'Employee' }]);
            assert.strictEqual(request.body.files[0].name, 'agreement.docx');
            assert.strictEqual(Buffer.from(request.body.files[0].file_base64, 'base64').toString(), 'word');
            assert.deepStrictEqual(result, {
                id: 't-1',
                name: 'Agreement',
                status: 'Created',
                archived: false,
                editUrl: 'https://www.signwell.com/edit/template/t-1/',
                placeholders: [{ id: '1', name: 'Employee' }],
                fields: [],
            });
        })

        it('reports an API error as a bad gateway with the service status', async function() {
            const { fetch } = fakeFetch({ status: 422, json: { errors: { files: ['bad'] } } });
            const service = signwell({ apiKey: 'key', webhookId: WEBHOOK_ID, fetch });

            await assert.rejects(service.createTemplate({ name: 'x', file: Buffer.from('') }), e => e.status === 502 && /status=422/.test(e.message));
        })
    })

    describe('template', function() {
        it('describes the fields of every file with their signer role', async function() {
            const { fetch, requests } = fakeFetch({ json: {
                id: 't-1', status: 'Available', placeholders: [{ id: '1', name: 'Employee', signing_order: 1 }],
                fields: [[{ api_id: 'fullName', type: 'text', placeholder_name: 'Employee' }], [{ api_id: 'Signature_1', type: 'signature', placeholder_name: 'Employee' }]],
            } });
            const service = signwell({ apiKey: 'key', webhookId: WEBHOOK_ID, fetch });

            const result = await service.template('t-1');

            assert.strictEqual(requests[0].method, 'GET');
            assert.ok(requests[0].url.endsWith('/api/v1/document_templates/t-1'));
            assert.deepStrictEqual(result.placeholders, [{ id: '1', name: 'Employee' }]);
            assert.deepStrictEqual(result.fields, [
                { apiId: 'fullName', type: 'text', placeholder: 'Employee' },
                { apiId: 'Signature_1', type: 'signature', placeholder: 'Employee' },
            ]);
        })

        it('describes a preassigned recipient as assigned', async function() {
            const { fetch } = fakeFetch({ json: {
                id: 't-1', status: 'Available',
                placeholders: [
                    { id: '1', name: 'Employee', preassigned_recipient_name: null, preassigned_recipient_email: null },
                    { id: '2', name: 'Company', preassigned_recipient_name: 'Owner', preassigned_recipient_email: 'owner@example.com' },
                ],
                fields: [],
            } });
            const service = signwell({ apiKey: 'key', webhookId: WEBHOOK_ID, fetch });

            const result = await service.template('t-1');

            assert.deepStrictEqual(result.placeholders, [
                { id: '1', name: 'Employee' },
                { id: '2', name: 'Company', assigned: { name: 'Owner', email: 'owner@example.com' } },
            ]);
        })

        it('is undefined for a template the service does not have', async function() {
            const { fetch } = fakeFetch({ status: 404 });
            const service = signwell({ apiKey: 'key', webhookId: WEBHOOK_ID, fetch });

            assert.strictEqual(await service.template('gone'), undefined);
        })
    })

    describe('createFromTemplate', function() {
        it('posts the template, the signer as its role and the field values for embedded signing', async function() {
            const { fetch, requests } = fakeFetch({ status: 201, json: { id: 'doc-1', recipients: [{ id: '1', embedded_signing_url: 'https://sign/doc-1' }] } });
            const service = signwell({ apiKey: 'key', webhookId: WEBHOOK_ID, fetch });

            const result = await service.createFromTemplate({
                templateId: 't-1',
                name: 'Agreement',
                signer: { name: 'Dee Driver', email: 'dee@example.com' },
                placeholder: 'Employee',
                values: { fullName: 'Dee Driver', hourlyRate: '$25.00' },
                redirectUrl: 'https://ops/back',
                metadata: { requestId: 'req-1' },
            });

            const [request] = requests;

            assert.deepStrictEqual(result, { id: 'doc-1', signingUrl: 'https://sign/doc-1' });
            assert.strictEqual(request.method, 'POST');
            assert.ok(request.url.endsWith('/api/v1/document_templates/documents'));
            assert.strictEqual(request.headers['X-Api-Key'], 'key');
            assert.strictEqual(request.body.template_id, 't-1');
            assert.strictEqual(request.body.test_mode, true, 'test mode unless turned off');
            assert.strictEqual(request.body.embedded_signing, true);
            assert.deepStrictEqual(request.body.recipients, [{ id: '1', placeholder_name: 'Employee', name: 'Dee Driver', email: 'dee@example.com', send_email: false }]);
            assert.deepStrictEqual(request.body.template_fields, [{ api_id: 'fullName', value: 'Dee Driver' }, { api_id: 'hourlyRate', value: '$25.00' }]);
            assert.strictEqual(request.body.redirect_url, 'https://ops/back');
            assert.deepStrictEqual(request.body.metadata, { requestId: 'req-1' });
            assert.strictEqual(request.body.apply_signing_order, undefined, 'no signing order for one signer');
        })

        it('adds the cosigners after the signer, in signing order', async function() {
            const { fetch, requests } = fakeFetch({ status: 201, json: { id: 'doc-1', recipients: [{ id: '1', email: 'dee@example.com', embedded_signing_url: 'https://sign/doc-1/1' }, { id: '2', email: 'owner@example.com', embedded_signing_url: 'https://sign/doc-1/2' }] } });
            const service = signwell({ apiKey: 'key', webhookId: WEBHOOK_ID, fetch });

            const result = await service.createFromTemplate({
                templateId: 't-1',
                name: 'Agreement',
                signer: { name: 'Dee Driver', email: 'dee@example.com' },
                placeholder: 'Employee',
                cosigners: [{ placeholder: 'Company', name: 'Owner', email: 'owner@example.com' }],
            });

            const [request] = requests;

            assert.strictEqual(result.signingUrl, 'https://sign/doc-1/1', "the signer's url");
            assert.strictEqual(request.body.apply_signing_order, true);
            assert.deepStrictEqual(request.body.recipients, [
                { id: '1', placeholder_name: 'Employee', name: 'Dee Driver', email: 'dee@example.com', send_email: false },
                { id: '2', placeholder_name: 'Company', name: 'Owner', email: 'owner@example.com', send_email: false },
            ]);
        })

        it('falls back to the signing url when there is no embedded one', async function() {
            const { fetch } = fakeFetch({ json: { id: 'doc-1', recipients: [{ id: '1', signing_url: 'https://sign/doc-1' }] } });
            const service = signwell({ apiKey: 'key', webhookId: WEBHOOK_ID, fetch, testMode: false });

            const result = await service.createFromTemplate({ templateId: 't-1', name: 'x', signer: {}, placeholder: 'Employee' });

            assert.strictEqual(result.signingUrl, 'https://sign/doc-1');
        })
    })

    describe('signingUrl', function() {
        it("gives the url of the recipient with the email", async function() {
            const { fetch } = fakeFetch({ json: { id: 'doc-1', recipients: [{ id: '1', email: 'dee@example.com', embedded_signing_url: 'https://sign/1' }, { id: '2', email: 'Owner@Example.com', embedded_signing_url: 'https://sign/2' }] } });
            const service = signwell({ apiKey: 'key', webhookId: WEBHOOK_ID, fetch });

            assert.strictEqual(await service.signingUrl('doc-1', { email: 'owner@example.com' }), 'https://sign/2');
        })

        it("gives the first recipient's url without an email", async function() {
            const { fetch } = fakeFetch({ json: { id: 'doc-1', recipients: [{ id: '1', embedded_signing_url: 'https://sign/1' }, { id: '2', embedded_signing_url: 'https://sign/2' }] } });
            const service = signwell({ apiKey: 'key', webhookId: WEBHOOK_ID, fetch });

            assert.strictEqual(await service.signingUrl('doc-1'), 'https://sign/1');
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
