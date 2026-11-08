const javascript = require('gell-domain/binding/javascript');

const namespace = require('./namespace');
const ecosystem = require('./ecosystem');

const TYPE = 'NAMESPACE#ECOSYSTEM';

const model = {
    name: TYPE,
    extends: [namespace.model],
    parent: ecosystem,
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
