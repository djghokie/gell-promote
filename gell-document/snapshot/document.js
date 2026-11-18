const assert = require('assert');

const document = require('gell-promote/gell-document/domain/document');

exports.__metadata = {
    name: 'document',
    description: 'returns a DOCUMENT by id; an unsaved DOCUMENT (no content or updatedTs) if it has never been saved',
    triggers: {
        effect: {
            params: { id: 'string' }
        },
        api: {
            params: { id: 'string' }
        }
    }
}

exports.effect = async function({ params={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    logger.info('executing effect (name="document")');

    const { id } = params;

    assert(id, 'id is required');

    const type = types ? types.name(document.TYPE) : document.TYPE;

    // NOTE: gell-http's API wrapper can't serialize a null result, so return an unsaved placeholder
    return (await store.lookup({ type, id })) || { type, id };
}

exports.api = exports.effect;
