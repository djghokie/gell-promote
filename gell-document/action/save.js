const assert = require('assert');

const document = require('gell-promote/gell-document/domain/document');

exports.__metadata = {
    name: 'document.save',
    description: 'creates or replaces the content of a DOCUMENT',
    triggers: {
        action: {
            params: {
                id: 'string',
                format: 'string',
                content: 'string',
                title: { type: 'string', optional: true },
            },
            transaction: 'NEW'
        }
    }
}

exports.action = async function({ params={}, context={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');
    const types = deps.resolveSingle({ name: 'types', optional: true });
    const { $txn } = context;

    logger.info('executing action (name="document.save")');

    const { id, format, content, title } = params;

    assert(id, 'id is required');
    assert(document.FORMATS.includes(format), `format must be one of ${document.FORMATS.join(', ')}`);
    assert(typeof content === 'string', 'content must be a string');

    const type = types ? types.name(document.TYPE) : document.TYPE;
    const existing$ = await store.lookup({ type, id });

    const document$ = {
        ...existing$,
        id,
        format,
        content,
        title: title ?? existing$?.title,
        updatedTs: Date.now(),
    };

    // NOTE: types.instance namespaces the record by the current TENANT (register DOCUMENT with the TENANT namespace)
    const document_ = types ? types.instance(document.TYPE, document$) : document.materialize(document$);

    $txn.next({ operation: 'put', item: document_ });

    return document_;
}
