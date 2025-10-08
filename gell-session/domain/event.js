const session = require('gell-session/domain/session');
const javascript = require('gell-domain/binding/javascript');

const TYPE = "SESSION#EVENT";

/**
 * WIP: replacement for legacy event type
 *  - legacy type not really being used anywhere
 *  - unclear whether or not each event should have its own type
 *      - could change how events are queried
 *      - probably will be more clear when UI is developed
 */
const model = {
    name: TYPE,
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },

        name: 'string',
        stereotype: {
            type: 'string',
            description: 'unclear what this is for',
            default: 'EVENT'
        },
        trigger: {
            type: 'string',
            description: 'unclear what this is for; this is would be "action" or "effect"'
        },
    }
}

module.exports = {
    TYPE,
    model,
    materialize: session$ => javascript.materialize(session$, model)
}