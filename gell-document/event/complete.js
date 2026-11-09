const lookup = require('gell-session/snapshot/lookup');

const crypto = require('crypto');

const request = require('../domain/request');
const signed = require('../domain/signed');

/**
 * Records a signature request the e-signature service reports completed (from ./webhook)
 *  - params.id: the DOCUMENT#REQUEST
 *  - downloads the completed PDF (with the service's audit page) into documentStorage and writes the
 *    DOCUMENT#SIGNED; the request becomes COMPLETED with signedId
 *  - safe to receive twice: a request that already has its signed copy returns it
 *  - then runs the application's signed hook, if it has one: the `documentHooks` dependency maps a template
 *    name to { signed } (an effect module), run with context { signed_, request_, $txn }
 *    (e.g. hr.employee.agreement -> ps-hr/employee/agreement/event/signed)
 *  - a request cancelled before the service reported it signed is still recorded (the signer did sign), as
 *    SUPERSEDED: the request stays CANCELED, document.signed leaves it out and the hook does not run
 *  - returns the DOCUMENT#SIGNED state
 */
exports.__metadata = {
    name: 'document.request.complete',
    description: 'records a signed document reported by the e-signature service',
    triggers: {
        effect: {
            params: {
                id: 'uuid',
            },
            context: {
                $txn: 'state'
            }
        }
    }
}

// NOTE: an explicit dependency, not the gell registry - discovery only registers modules with an action or api
function application(name, deps) {
    let hooks;
    try {
        hooks = deps.resolveSingle('documentHooks');
    } catch (e) {
        return undefined;
    }

    return (hooks || {})[name] && hooks[name].signed;
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger, signing, documentStorage } = deps.resolve('logger', 'signing', 'documentStorage');
    const { $txn } = context;

    logger.info('executing effect (name="document.request.complete")');

    const request_ = await lookup.effect({
        params: { key: { type: request.TYPE, id: params.id } },
        context: { materialize: request.materialize },
        deps
    });

    if (!request_) {
        logger.warn(`signature request not found (id=${params.id})`);
        return undefined;
    }

    const request$ = request_.snapshot();

    if (request$.signedId) {
        logger.info(`signature request already recorded (id=${request$.id}; signedId=${request$.signedId})`);

        return lookup.effect({
            params: { key: { type: signed.TYPE, id: request$.signedId } },
            context: { materialize: signed.materialize },
            deps
        });
    }

    const pdf = await signing.download(request$.serviceDocumentId);

    const signedTs = Date.now();

    const current = request$.status === 'PENDING';

    const signed_ = signed.materialize({
        parentId: request$.parentId,
        parentType: request$.parentType,
        name: request$.name,
        templateId: request$.templateId,
        templateVersion: request$.templateVersion,
        title: request$.title,
        text: request$.text,
        values: request$.values,
        ...(request$.data ? { data: request$.data } : {}),
        signature: {
            name: (request$.signer || {}).name,
            signedTs,
            hash: request$.hash,
        },
        signedTs,
        service: request$.service,
        serviceDocumentId: request$.serviceDocumentId,
        requestId: request$.id,
        pdfHash: crypto.createHash('sha256').update(pdf).digest('hex'),
        // signed after its request was cancelled (e.g. the rate changed): kept, but not the current signature
        status: current ? 'SIGNED' : 'SUPERSEDED',
    });

    const pdfKey = `${request$.name}/${request$.parentId}/${signed_.snapshotAttribute('id')}.pdf`;

    await documentStorage.put(pdfKey, pdf, 'application/pdf');

    signed_.set('pdfKey', pdfKey);


    if (current) {
        request_.set('status', 'COMPLETED');
        request_.set('completedTs', signedTs);
    }
    request_.set('signedId', signed_.snapshotAttribute('id'));

    $txn.next({ operation: 'put', item: signed_ });
    $txn.next({ operation: 'put', item: request_ });

    logger.info(`recorded signed document (requestId=${request$.id}; signedId=${signed_.snapshotAttribute('id')}; status=${request$.status})`);

    const handler = current && application(request$.name, deps);

    if (handler && handler.effect) await handler.effect({ context: { signed_, request_, $txn }, deps });

    return signed_;
}
