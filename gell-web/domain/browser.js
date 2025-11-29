const session = require('gell-session/domain/session');
const javascript = require('gell-domain/binding/javascript');

const TYPE = "WEB#BROWSER";

/**
 * WIP: rewrite of the original browser session type
 *  - original implementation based on cookies
 *  - has "server" perspective that probably isn't needed anymore
 *  - this might need to support multiple roles eventually
 */
const model = {
    name: TYPE,
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        role: {
            type: 'string',
            description: 'authorizes BROWSER session for a particular role'
        }
    }
}

module.exports = {
    TYPE,
    model,
    materialize: session$ => javascript.materialize(session$, model)
}
