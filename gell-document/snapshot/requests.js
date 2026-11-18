const request = require('../domain/request');

/**
 * The signature requests for a record, newest first
 *  - params.name: the template name
 *  - context.parent_: the record they were sent for - a State, or a { type, id } key
 */
exports.__metadata = {
    name: 'document.requests',
    description: 'lists the signature requests for a record',
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

    logger.info('executing effect (name="document.requests")');

    const requests$ = await store.drain('session.children', { type: request.TYPE, parentId: idOf(context.parent_) });

    return requests$
        .filter(r$ => r$.name === params.name)
        .sort((r1, r2) => (r2.initiatedTs || 0) - (r1.initiatedTs || 0))
        .map(request.materialize);
}
