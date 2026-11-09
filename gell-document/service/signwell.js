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
 *  - create({ name, pdf, filename, signer: { name, email }, fields, redirectUrl, declineRedirectUrl, metadata })
 *      -> { id, signingUrl }
 *  - signingUrl(id) -> a fresh signing URL for the (only) signer
 *  - cancel(id): stops signing; a document that is gone already is fine
 *  - download(id) -> Uint8Array of the completed PDF, audit page included
 *  - remove(id): deletes the document from the service
 *  - parse(payload) -> { status: 'COMPLETED' | 'DECLINED' | 'EXPIRED' | 'CANCELED' | undefined, serviceDocumentId,
 *      requestId, testMode, reason } for a verified webhook event; throws a 401 error if it does not verify
 *
 * WIP: how long an embedded signing URL stays valid isn't documented - signingUrl() fetches a fresh one each time
 * WIP: SignWell documents the embedded signing URL inside its iframe script; a full-page redirect is assumed
 *      to work the same - check on a phone (sc-525)
 */
const NAME = 'SIGNWELL';

const BASE_URL = 'https://www.signwell.com/api/v1';

// days before SignWell expires an unsigned document
const EXPIRES_IN_DAYS = 30;

const STATUSES = {
    document_completed: 'COMPLETED',
    document_declined: 'DECLINED',
    document_expired: 'EXPIRED',
    document_canceled: 'CANCELED',
};

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

    function urlOf(document) {
        const [recipient] = (document && document.recipients) || [];

        return recipient && (recipient.embedded_signing_url || recipient.signing_url);
    }

    return {
        name: NAME,
        testMode,

        async create({ name, pdf, filename='document.pdf', signer, fields=[], redirectUrl, declineRedirectUrl, metadata={} }) {
            const document = await call('POST', '/documents', {
                body: {
                    name,
                    test_mode: testMode,
                    draft: false,
                    embedded_signing: true,
                    embedded_signing_notifications: false,
                    reminders: false,
                    allow_decline: true,
                    allow_reassign: false,
                    expires_in: EXPIRES_IN_DAYS,
                    ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
                    ...(declineRedirectUrl ? { decline_redirect_url: declineRedirectUrl } : {}),
                    files: [{ name: filename, file_base64: Buffer.from(pdf).toString('base64') }],
                    recipients: [{ id: '1', name: signer.name, email: signer.email, send_email: false }],
                    fields: [fields.map((field, i) => ({
                        api_id: `${field.type}_${i + 1}`,
                        type: field.type,
                        page: field.page,
                        x: Math.round(field.x),
                        y: Math.round(field.y),
                        width: Math.round(field.width),
                        height: Math.round(field.height),
                        recipient_id: '1',
                        required: true,
                        ...(field.type === 'date' ? { lock_sign_date: true } : {}),
                    }))],
                    metadata,
                }
            });

            return { id: document.id, signingUrl: urlOf(document) };
        },

        async signingUrl(id) {
            return urlOf(await call('GET', `/documents/${id}`));
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
            };
        },
    };
}

module.exports.NAME = NAME;
