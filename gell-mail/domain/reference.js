const javascript = require('gell-domain/binding/javascript');
const session = require('gell-session/domain/session');

const TYPE = 'MAIL#REFERENCE';

/**
 * Associates a MAIL#MESSAGE with another record it is about, besides its parent
 *  - parentId/parentType: that record (e.g. the AGREEMENT of an agreement notice, the CUSTOMER of an itinerary email)
 *  - messageId: the MAIL#MESSAGE
 *  - written in the same transaction as the message; holds no message content
 */
const model = {
    name: TYPE,
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        parentType: 'string',
        messageId: 'uuid',
    },
}

module.exports = {
    TYPE,
    model,
    materialize: session$ => javascript.materialize(session$, model)
}
