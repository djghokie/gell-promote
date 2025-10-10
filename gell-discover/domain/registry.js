const javascript = require('gell-domain/binding/javascript');

const TYPE = "GELL#REGISTRY";

const model = {
    // extends: [session.model],
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