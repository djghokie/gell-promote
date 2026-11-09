const signed = require('../domain/signed');
const { invalid } = require('../lib/errors');
const { hash, sameName } = require('../lib/signature');
const render = require('../snapshot/render');

/**
 * Signs the published version of a document template for a record, by typed name
 *  - params.name: the template name
 *  - params.templateVersion: the version the signer read; refused if a newer version was published since
 *  - params.signatureName: the typed signature; params.signerName: the name it must match
 *  - params.values: the merge field values - the text is rendered again here, never taken from the client
 *  - params.data (optional): application values to keep with the signature (e.g. { hourlyRate })
 *  - params.label (optional): what the document is called in error messages (default 'document')
 *  - context.parent_: the record it is signed for (a State, or a { type, id } key); context.$txn
 *  - context.template_ (optional): the PUBLISHED version, when the caller already loaded it
 *  - returns the DOCUMENT#SIGNED state, put in $txn
 */
exports.__metadata = {
    name: 'document.sign',
    description: 'signs the published version of a document template by typed name',
    triggers: {
        effect: {
            params: {
                name: 'string',
                templateVersion: 'number',
                signatureName: 'string',
                signerName: 'string',
                values: 'object',
                data: { type: 'object', optional: true },
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
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="document.sign")');

    const { name, templateVersion, signatureName, signerName, values, data, label='document' } = params;
    const { parent_, $txn } = context;

    const rendered = await render.effect({ params: { name, values }, context: { template_: context.template_ }, deps });

    if (!rendered) throw invalid(`the ${label} is not ready yet`);

    const { template_, title, text } = rendered;

    // the text is rendered again here; refuse if a newer version was published after the signer opened it
    if (template_.snapshotAttribute('version') !== templateVersion) {
        throw invalid(`the ${label} was updated - please review it again before signing`);
    }

    if (!sameName(signatureName, signerName)) throw invalid('signature must be your full name');

    const parent = keyOf(parent_);
    const signedTs = Date.now();

    const signed_ = signed.materialize({
        parentId: parent.id,
        parentType: parent.type,
        name,
        templateId: template_.snapshotAttribute('id'),
        templateVersion,
        title,
        text,
        values,
        ...(data ? { data } : {}),
        signature: {
            name: signatureName.trim(),
            signedTs,
            hash: hash(title, text),
        },
        signedTs,
        status: 'SIGNED',
    });

    $txn.next({ operation: 'put', item: signed_ });

    logger.info(`signed document (name=${name}; version=${templateVersion}; parentId=${parent.id})`);

    return signed_;
}
