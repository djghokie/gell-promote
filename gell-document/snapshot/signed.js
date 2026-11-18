const signed = require('../domain/signed');

/**
 * The documents signed for a record, newest first
 *  - params.name: the template name
 *  - context.parent_: the record they were signed for - a State, or a { type, id } key
 *  - params.superseded: also those signed after their request was cancelled (SUPERSEDED) - for audit and purge
 */
exports.__metadata = {
    name: 'document.signed',
    description: 'lists the documents signed for a record',
    triggers: {
        effect: {
            params: {
                name: 'string',
                superseded: { type: 'boolean', optional: true },
            },
            context: {
                parent_: 'state'
            }
        }
    }
}

function idOf(record) {
    return typeof record.snapshotAttribute === 'function' ? record.snapshotAttribute('id') : record.id;
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');

    logger.info('executing effect (name="document.signed")');

    const signed$ = await store.drain('session.children', { type: signed.TYPE, parentId: idOf(context.parent_) });

    return signed$
        .filter(s$ => s$.name === params.name)
        .filter(s$ => params.superseded || s$.status !== 'SUPERSEDED')
        .sort((s1, s2) => (s2.signedTs || 0) - (s1.signedTs || 0))
        .map(signed.materialize);
}
