const lookup = require('gell-session/snapshot/lookup');

const signed = require('../domain/signed');

/**
 * A temporary download link for a signed document's PDF (signed through an e-signature service)
 *  - params.id: the DOCUMENT#SIGNED
 *  - returns { url, filename }, or undefined when the document has no PDF (typed-name, or purged)
 *  - applications expose it with their own roles
 */
exports.__metadata = {
    name: 'document.signed.download',
    description: 'returns a temporary download link for a signed document PDF',
    triggers: {
        effect: {
            params: {
                id: 'uuid',
            }
        }
    }
}

function filenameOf(signed$) {
    const title = String(signed$.title || 'document').replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '-');
    const day = new Date(signed$.signedTs || Date.now()).toISOString().slice(0, 10);

    return `${title || 'document'}-${(signed$.signature || {}).name ? signed$.signature.name.replace(/[^A-Za-z0-9]+/g, '-') + '-' : ''}${day}.pdf`;
}

exports.filenameOf = filenameOf;

exports.effect = async function({ params={}, deps }) {
    const { logger, documentStorage } = deps.resolve('logger', 'documentStorage');

    logger.info('executing effect (name="document.signed.download")');

    const signed_ = await lookup.effect({
        params: { key: { type: signed.TYPE, id: params.id } },
        context: { materialize: signed.materialize },
        deps
    });

    if (!signed_) return undefined;

    const signed$ = signed_.snapshot();
    if (!signed$.pdfKey) return undefined;

    const filename = filenameOf(signed$);

    return { url: await documentStorage.url(signed$.pdfKey, { filename }), filename };
}
