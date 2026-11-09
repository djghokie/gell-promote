const signed = require('../domain/signed');

/**
 * The documents signed for a record, newest first
 *  - params.name: the template name
 *  - context.parent_: the record they were signed for - a State, or a { type, id } key
 */
exports.__metadata = {
    name: 'document.signed',
    description: 'lists the documents signed for a record',
    triggers: {
        effect: {
            params: {
                name: 'string',
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
        .sort((s1, s2) => (s2.signedTs || 0) - (s1.signedTs || 0))
        .map(signed.materialize);
}
