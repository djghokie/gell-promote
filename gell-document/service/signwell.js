const assert = require('assert');
const crypto = require('crypto');

/**
 * SignWell e-signature service (https://developers.signwell.com) for gell-document requests
 *  - define as the `signing` dependency: signwell({ apiKey, webhookId, testMode })
 *  - documents are created with embedded signing: SignWell sends no emails, and the application sends the
 *    signer to the recipient's embedded signing URL; SignWell redirects them to redirectUrl afterwards
 *  - testMode: test documents are not billed and are not legally binding - production must turn it off
 *  - webhookId: SignWell signs webhook events with the webhook's id (HMAC-SHA256 of "<type>@<time>")
 *
 * The service interface (also implemented by ./fake):
 *  - createTemplate({ name, filename, file, placeholder }) -> a draft template (see describe) with one signer
 *      role named placeholder, to be finished in the service's editor (editUrl)
 *  - template(id) -> the template (see describe), or undefined if the service has no such template
 *  - templateIdOf(text) -> the template id in what someone pasted: the id itself, or a SignWell link to the
 *      template (e.g. https://www.signwell.com/edit/template/<id>/); undefined for a link without one
 *  - createFromTemplate({ templateId, name, signer: { name, email }, placeholder, cosigners: [{ placeholder, name,
 *      email }], values: { apiId: value }, redirectUrl, declineRedirectUrl, metadata }) -> { id, signingUrl }
 *      - the signer signs first, then each cosigner in order (signing order); signingUrl is the signer's
 *  - signingUrl(id, { email }) -> a fresh signing URL for the recipient with that email (the first one otherwise)
 *  - cancel(id): stops signing; a document that is gone already is fine
 *  - download(id) -> Uint8Array of the completed PDF, audit page included
 *  - remove(id): deletes the document from the service
 *  - parse(payload) -> { status: 'SIGNED' | 'COMPLETED' | 'DECLINED' | 'EXPIRED' | 'CANCELED' | undefined,
 *      serviceDocumentId, requestId, testMode, reason, signerEmail } for a verified webhook event; throws a 401
 *      error if it does not verify - SIGNED is one recipient signing (signerEmail), COMPLETED all of them
 *
 * A template as described: { id, name, status, archived, editUrl, placeholders: [{ id, name, assigned }],
 *   fields: [{ apiId, type, placeholder }] } - status is SignWell's ('Created' while a draft, then 'Available');
 *   assigned: { name, email } of a role with a preassigned recipient (the same person on every document)
 *
 * WIP: how long an embedded signing URL stays valid isn't documented - signingUrl() fetches a fresh one each time
 * WIP: SignWell documents the embedded signing URL inside its iframe script; a full-page redirect is assumed
 *      to work the same - check on a phone (sc-525)
 * WIP: unverified against a live account (the API reference only): that a draft template can be created with
 *      no fields, that a draft reports status 'Created', that a document from a template returns the
 *      recipients' embedded_signing_url like a document from a file, and how an unknown template_fields api_id
 *      is treated (only the template's own text fields are sent - see ../event/request), that signing order stops
 *      a cosigner's embedded URL working before the signer signs, and that a GET returns a usable embedded URL
 *      for each recipient
 */
const NAME = 'SIGNWELL';

const BASE_URL = 'https://www.signwell.com/api/v1';

// days before SignWell expires an unsigned document
const EXPIRES_IN_DAYS = 30;

const STATUSES = {
    document_signed: 'SIGNED',
    document_completed: 'COMPLETED',
    document_declined: 'DECLINED',
    document_expired: 'EXPIRED',
    document_canceled: 'CANCELED',
};

// SignWell's template: fields are one array per file
function describe(template={}) {
    return {
        id: template.id,
        name: template.name,
        status: template.status,
        archived: !!template.archived,
        editUrl: template.embedded_edit_url || undefined,
        placeholders: (template.placeholders || []).map(p => ({
            id: p.id,
            name: p.name,
            ...(p.preassigned_recipient_email ? { assigned: { name: p.preassigned_recipient_name || p.preassigned_recipient_email, email: p.preassigned_recipient_email } } : {}),
        })),
        fields: [].concat(...(template.fields || [])).map(f => ({ apiId: f.api_id, type: f.type, placeholder: f.placeholder_name })),
    };
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * The template id in a pasted id or link - links carry it as a UUID in the path (an edit link,
 * /edit/template/<id>/); a sharing link such as /new_doc/<code>/ does not have it
 */
function templateIdOf(text) {
    const value = String(text || '').trim();

    if (!/^https?:\/\//i.test(value)) return value || undefined;

    let path;
    try {
        path = new URL(value).pathname;
    } catch (e) {
        return undefined;
    }

    const match = path.match(UUID);

    return match ? match[0].toLowerCase() : undefined;
}

function error(message, status) {
    const e = new Error(message);
    e.status = status;
    if (status === 401) e.name = 'UnauthorizedError';

    return e;
}

module.exports = function signwell({ apiKey, webhookId, testMode=true, baseUrl=BASE_URL, fetch: fetchImpl=globalThis.fetch }={}) {
    assert(apiKey, 'SignWell API key is required');

    async function call(method, path, { body, binary=false, allowNotFound=false }={}) {
        const response = await fetchImpl(`${baseUrl}${path}`, {
            method,
            headers: {
                'X-Api-Key': apiKey,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
                ...(binary ? { Accept: 'application/pdf' } : { Accept: 'application/json' }),
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (allowNotFound && response.status === 404) return undefined;

        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw error(`SignWell ${method} ${path} failed (status=${response.status}; detail=${detail.slice(0, 500)})`, 502);
        }

        if (response.status === 204) return undefined;
        if (binary) return new Uint8Array(await response.arrayBuffer());

        return response.json();
    }

    // the recipient with email (the first recipient when no email is given)
    function urlOf(document, email) {
        const recipients = (document && document.recipients) || [];
        const recipient = email
            ? recipients.find(r => String(r.email || '').toLowerCase() === String(email).toLowerCase())
            : recipients[0];

        return recipient && (recipient.embedded_signing_url || recipient.signing_url);
    }

    return {
        name: NAME,
        testMode,
        templateIdOf,

        async createTemplate({ name, filename='document.pdf', file, placeholder='Signer' }) {
            const template = await call('POST', '/document_templates', {
                body: {
                    name,
                    // finished in SignWell's editor: the fields are placed there
                    draft: true,
                    files: [{ name: filename, file_base64: Buffer.from(file).toString('base64') }],
                    placeholders: [{ id: '1', name: placeholder }],
                }
            });

            return describe(template);
        },

        async template(id) {
            const template = await call('GET', `/document_templates/${id}`, { allowNotFound: true });

            return template ? describe(template) : undefined;
        },

        async createFromTemplate({ templateId, name, signer, placeholder, cosigners=[], values={}, redirectUrl, declineRedirectUrl, metadata={} }) {
            const document = await call('POST', '/document_templates/documents', {
                body: {
                    template_id: templateId,
                    name,
                    test_mode: testMode,
                    draft: false,
                    embedded_signing: true,
                    embedded_signing_notifications: false,
                    reminders: false,
                    allow_decline: true,
                    expires_in: EXPIRES_IN_DAYS,
                    ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
                    ...(declineRedirectUrl ? { decline_redirect_url: declineRedirectUrl } : {}),
                    // the signer first, then the cosigners - each waits for the one before (signing order)
                    ...(cosigners.length > 0 ? { apply_signing_order: true } : {}),
                    recipients: [
                        { id: '1', placeholder_name: placeholder, name: signer.name, email: signer.email, send_email: false },
                        ...cosigners.map((c, i) => ({ id: String(i + 2), placeholder_name: c.placeholder, name: c.name, email: c.email, send_email: false })),
                    ],
                    template_fields: Object.entries(values).map(([apiId, value]) => ({ api_id: apiId, value: String(value) })),
                    metadata,
                }
            });

            return { id: document.id, signingUrl: urlOf(document) };
        },

        async signingUrl(id, { email }={}) {
            return urlOf(await call('GET', `/documents/${id}`), email);
        },

        async cancel(id) {
            await call('DELETE', `/documents/${id}`, { allowNotFound: true });
        },

        async download(id) {
            return call('GET', `/documents/${id}/completed_pdf?audit_page=true`, { binary: true });
        },

        async remove(id) {
            await call('DELETE', `/documents/${id}`, { allowNotFound: true });
        },

        parse(payload={}) {
            assert(webhookId, 'SignWell webhook id is required to verify events');

            const { event={}, data={} } = payload;
            const expected = crypto.createHmac('sha256', webhookId).update(`${event.type}@${event.time}`).digest('hex');

            const given = Buffer.from(String(event.hash || ''));
            if (given.length !== expected.length || !crypto.timingSafeEqual(given, Buffer.from(expected))) {
                throw error('SignWell event did not verify', 401);
            }

            const object = data.object || {};

            return {
                status: STATUSES[event.type],
                type: event.type,
                serviceDocumentId: object.id,
                requestId: object.metadata && object.metadata.requestId,
                testMode: !!object.test_mode,
                reason: object.decline_reason || undefined,
                // the recipient who signed (document_signed), viewed or declined
                signerEmail: (event.related_signer && event.related_signer.email) || undefined,
            };
        },
    };
}

module.exports.NAME = NAME;
module.exports.describe = describe;
module.exports.templateIdOf = templateIdOf;
