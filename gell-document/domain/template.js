const javascript = require('gell-domain/binding/javascript');
const session = require('gell-session/domain/session');

const TYPE = 'DOCUMENT#TEMPLATE';

/**
 * One version of a document template (an employment agreement, a consent, ...)
 *  - name: which document this is a version of (e.g. 'hr.employee.agreement'); versions are numbered per name
 *  - body is plain text (blank lines separate paragraphs) with {{field}} merge fields (see ../lib/render)
 *  - at most one DRAFT per name; publishing it RETIRES the PUBLISHED version; published versions never change
 */
const STATUSES = {
    DRAFT: { description: 'being edited; not shown to signers' },
    PUBLISHED: { description: 'the version that is signed' },
    RETIRED: { description: 'replaced by a newer published version; kept for signed documents' },
};

const model = {
    name: TYPE,
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        status: {
            type: 'string',
            default: 'DRAFT'
        },
        name: {
            type: 'string',
            description: 'which document this is a version of, e.g. hr.employee.agreement'
        },
        version: 'number',
        title: 'string',
        body: 'text',
        publishedTs: 'timestamp',
        publishedBy: 'string',
    },

    workflow: {
        statuses: STATUSES
    }
}

module.exports = {
    TYPE,
    STATUSES,
    model,
    materialize: session$ => javascript.materialize(session$, model)
}
