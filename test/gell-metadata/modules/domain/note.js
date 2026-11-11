const javascript = require('gell-domain/binding/javascript');
const session = require('gell-session/domain/session');

const TYPE = 'UNITTEST#NOTE';

const model = {
    name: TYPE,
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        title: 'string',
        status: {
            type: 'string',
            default: 'DRAFT'
        },
    }
}

module.exports = {
    TYPE,
    model,
    materialize: note$ => javascript.materialize(note$, model)
}
