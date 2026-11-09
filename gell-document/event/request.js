const _ = require('lodash');

const request = require('../domain/request');
const { invalid } = require('../lib/errors');
const pdf = require('../lib/pdf');
const { hash } = require('../lib/signature');
const render = require('../snapshot/render');
const requests = require('../snapshot/requests');
const { cancelRequest } = require('./cancel');

/**
 * Asks for a signature on the published version of a document template through the e-signature service
 * (the `signing` dependency, e.g. ../service/signwell), and returns where the signer signs
 *  - params.name: the template name; params.values: the merge field values
 *  - params.signer: { name, email }; params.data (optional): application values kept with the signature
 *  - params.redirectUrl / declineRedirectUrl (optional): where the service sends the signer afterwards
 *  - params.label (optional): what the document is called in error messages (default 'document')
 *  - context.parent_: the record it is signed for (a State, or a { type, id } key); context.$txn
 *  - context.template_ (optional): the PUBLISHED version, when the caller already loaded it
 *  - a PENDING request for the same version, data and signer is reused (the signer left and came back);
 *    any other PENDING request for the record is cancelled first, so only one can be signed
 *  - the document is rendered to a PDF (../lib/pdf) with the signature and date fields after the text
 *  - returns { request_, signingUrl }; the service reports the outcome to ./webhook
 *
 * WIP: the document is created at the service before the transaction commits - if the transaction fails the
 *      service holds a document nothing refers to; it expires unsigned
 */
exports.__metadata = {
    name: 'document.request.create',
    description: 'asks for a signature on a document through the e-signature service',
    triggers: {
        effect: {
            params: {
                name: 'string',
                values: 'object',
                signer: 'object',
                data: { type: 'object', optional: true },
                redirectUrl: { type: 'string', optional: true },
                declineRedirectUrl: { type: 'string', optional: true },
                label: { type: 'string', optional: true },
            },
            context: {
                parent_: 'state',
                $txn: 'state'
            }
        }
    }
}

function keyOf(record) {
    return typeof record.snapshotPartial === 'function' ? record.snapshotPartial(['type', 'id']) : record;
}

function filenameOf(title) {
    return `${String(title || 'document').replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '-') || 'document'}.pdf`;
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger, signing } = deps.resolve('logger', 'signing');

    logger.info('executing effect (name="document.request.create")');

    const { name, values, signer, data, redirectUrl, declineRedirectUrl, label='document' } = params;
    const { parent_, $txn } = context;

    const rendered = await render.effect({ params: { name, values }, context: { template_: context.template_ }, deps });

    if (!rendered) throw invalid(`the ${label} is not ready yet`);

    const { template_, title, text } = rendered;
    const templateVersion = template_.snapshotAttribute('version');

    const pending_ = (await requests.effect({ params: { name }, context: { parent_ }, deps }))
        .filter(r_ => r_.snapshotAttribute('status') === 'PENDING');

    const reusable_ = pending_.find(r_ => {
        const r$ = r_.snapshotPartial(['templateVersion', 'data', 'signer', 'service']);

        return r$.templateVersion === templateVersion &&
            r$.service === signing.name &&
            _.isEqual(r$.data || {}, data || {}) &&
            (r$.signer || {}).email === signer.email &&
            (r$.signer || {}).name === signer.name;
    });

    if (reusable_) {
        const signingUrl = await signing.signingUrl(reusable_.snapshotAttribute('serviceDocumentId'));

        logger.info(`reusing signature request (id=${reusable_.snapshotAttribute('id')})`);

        return { request_: reusable_, signingUrl };
    }

    for (const stale_ of pending_) await cancelRequest(stale_, 'REPLACED', $txn, deps);

    const parent = keyOf(parent_);

    const request_ = request.materialize({
        parentId: parent.id,
        parentType: parent.type,
        name,
        templateId: template_.snapshotAttribute('id'),
        templateVersion,
        title,
        text,
        hash: hash(title, text),
        values,
        ...(data ? { data } : {}),
        signer: { name: signer.name, email: signer.email },
        service: signing.name,
        status: 'PENDING',
    });

    const requestId = request_.snapshotAttribute('id');

    const { bytes, fields } = await pdf.render({ title, text, signerName: signer.name });

    const created = await signing.create({
        name: title,
        pdf: bytes,
        filename: filenameOf(title),
        signer,
        fields,
        redirectUrl,
        declineRedirectUrl,
        metadata: { requestId, name },
    });

    request_.set('serviceDocumentId', created.id);

    $txn.next({ operation: 'put', item: request_ });

    logger.info(`created signature request (id=${requestId}; name=${name}; version=${templateVersion}; serviceDocumentId=${created.id})`);

    return { request_, signingUrl: created.signingUrl };
}
