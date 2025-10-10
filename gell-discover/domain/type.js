const javascript = require('gell-domain/binding/javascript');

const TYPE = "GELL#TYPE";

const model = {
    // extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        name: 'string'
    }
}

module.exports = {
    TYPE,
    model,
    materialize: session$ => javascript.materialize(session$, model)
}
