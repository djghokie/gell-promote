const _ = require('lodash');

const request = require('../domain/request');
const template = require('../domain/template');
const { invalid } = require('../lib/errors');
const choose = require('../snapshot/choose');
const requests = require('../snapshot/requests');
const { cancelRequest } = require('./cancel');
const { check } = require('./refresh');

/**
 * Asks for a signature on a document from a template at the e-signature service (the `signing` dependency,
 * e.g. ../service/signwell), and returns where the signer signs
 *  - params.name: what the document is (e.g. 'hr.employee.agreement')
 *  - params.templateId (optional): the DOCUMENT#TEMPLATE chosen for the record; the default template otherwise
 *  - params.values: merge field values { field: value } - sent for the template's text fields whose API id is
 *    the field name; the template's other fields are the signer's
 *  - params.signer: { name, email }; params.data (optional): application values kept with the signature
 *  - params.redirectUrl / declineRedirectUrl (optional): where the service sends the signer afterwards
 *  - params.label (optional): what the document is called in error messages (default 'document')
 *  - context.parent_: the record it is signed for (a State, or a { type, id } key); context.$txn
 *  - the template is checked at the service first (it may have been edited there since it was added)
 *  - a PENDING request from the same template, with the same data and signer, is reused (the signer left and
 *    came back); any other PENDING request for the record is cancelled first, so only one can be signed
 *  - returns { request_, signingUrl }; the service reports the outcome to ./webhook
 *
 * WIP: the document is created at the service before the transaction commits - if the transaction fails the
 *      service holds a document nothing refers to; it expires unsigned
 */
exports.__metadata = {
    name: 'document.request.create',
    description: 'asks for a signature on a document from a template at the e-signature service',
    triggers: {
        effect: {
            params: {
                name: 'string',
                templateId: { type: 'string', optional: true },
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

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger, signing } = deps.resolve('logger', 'signing');

    logger.info('executing effect (name="document.request.create")');

    const { name, templateId: chosenId, values={}, signer, data, redirectUrl, declineRedirectUrl, label='document' } = params;
    const { parent_, $txn } = context;

    const template_ = await choose.effect({ params: { name, id: chosenId }, deps });

    if (!template_ || !template.ready(template_)) throw invalid(`the ${label} is not ready yet`);

    const t$ = template_.snapshotPartial(['id', 'title', 'service', 'serviceTemplateId']);

    if (t$.service !== signing.name) throw invalid(`the ${label} template is at another e-signature service (${t$.service})`);

    const pending_ = (await requests.effect({ params: { name }, context: { parent_ }, deps }))
        .filter(r_ => r_.snapshotAttribute('status') === 'PENDING');

    const reusable_ = pending_.find(r_ => {
        const r$ = r_.snapshotPartial(['templateId', 'data', 'signer', 'service']);

        return r$.templateId === t$.id &&
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

    const described = await signing.template(t$.serviceTemplateId);
    const problems = check(described);

    if (problems.length > 0) {
        logger.warn(`document template is not ready at the service (id=${t$.id}; problems=${problems.join('; ')})`);
        throw invalid(`the ${label} is not ready yet`);
    }

    // only the template's own text fields: the rest of the values have nowhere to go
    const apiIds = described.fields.filter(f => f.type === 'text').map(f => f.apiId);
    const filled = _.pick(values, apiIds);
    const [placeholder] = described.placeholders;

    for (const stale_ of pending_) await cancelRequest(stale_, 'REPLACED', $txn, deps);

    const parent = keyOf(parent_);

    const request_ = request.materialize({
        parentId: parent.id,
        parentType: parent.type,
        name,
        templateId: t$.id,
        title: t$.title,
        values: filled,
        ...(data ? { data } : {}),
        signer: { name: signer.name, email: signer.email },
        service: signing.name,
        status: 'PENDING',
    });

    const requestId = request_.snapshotAttribute('id');

    const created = await signing.createFromTemplate({
        templateId: t$.serviceTemplateId,
        name: t$.title,
        signer,
        placeholder: placeholder.name,
        values: filled,
        redirectUrl,
        declineRedirectUrl,
        metadata: { requestId, name },
    });

    request_.set('serviceDocumentId', created.id);

    $txn.next({ operation: 'put', item: request_ });

    logger.info(`created signature request (id=${requestId}; name=${name}; templateId=${t$.id}; serviceDocumentId=${created.id})`);

    return { request_, signingUrl: created.signingUrl };
}
