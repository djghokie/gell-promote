const javascript = require('gell-domain/binding/javascript');
const session = require('gell-session/domain/session');

const TYPE = 'GELL#DOCUMENT';

const FORMATS = ['MARKDOWN', 'HTML'];

/**
 * A named, editable document (markdown or rich text HTML), scoped to the TENANT
 *
 * NOTE: `id` is a caller-chosen key (e.g. "markdown", "richtext") rather than a generated uuid, so a
 * page can load "its" document without a lookup query; the TENANT namespace keeps ids apart
 */
const model = {
    name: TYPE,
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        title: 'string',
        format: {
            type: 'string',
            default: 'MARKDOWN'
        },
        content: 'string',
        updatedTs: 'number',
    }
}

module.exports = {
    TYPE,
    FORMATS,
    model,
    materialize: document$ => javascript.materialize(document$, model)
}
