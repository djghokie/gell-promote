const session = require('gell-session/domain/session');
const javascript = require('gell-domain/binding/javascript');

const TYPE = "UNITTEST#TYPE";

const model = {
    name: TYPE,
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
    }
}

module.exports = {
    TYPE,
    model,
    materialize: session$ => javascript.materialize(session$, model)
}
