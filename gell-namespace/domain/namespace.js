const session = require('gell-session/domain/session');
const javascript = require('gell-domain/binding/javascript');

const model = {
    extends: [session.model],
    attributes: {
        name: {
            type: 'string',
            editable: true
        },
        namespaceId: {
            type: 'string',
            editable: true
        }
    },
    // WIP: don't think projections are being modeled for use currently (Oct 2026)
    projections: {
        association: ['id', 'label']
    }
}

module.exports = {
    model,
    materialize: session$ => javascript.materialize(session$, model)
}
