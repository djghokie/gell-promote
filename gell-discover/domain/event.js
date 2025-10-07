const javascript = require('gell-domain/binding/javascript');

const TYPE = "GELL#EVENT";

const model = {
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        name: 'string',
        description: 'text',
        roles: 'array',
        triggers: 'complex'
    }
}

module.exports = {
    TYPE,
    model,
    materialize: session$ => javascript.materialize(session$, model)
}
