const javascript = require('gell-domain/binding/javascript');
const session = require('gell-session/domain/session');

const TYPE = 'DOCUMENT#TEMPLATE';

/**
 * A template kept at the e-signature service (a SignWell template), that documents are signed from
 *  - the document itself (its file, layout and fields) is authored at the service; this records which
 *    templates the application uses, for what, and what the service last reported about each
 *  - name: what the template is used for (e.g. 'hr.employee.agreement'); several templates can share a name,
 *    and at most one ACTIVE template per name is the default (isDefault)
 *  - title: what people call it (e.g. 'Driver Employment Agreement')
 *  - service/serviceTemplateId: the service and its id for the template
 *  - checked from the service (../event/refresh): serviceStatus, editUrl, placeholders (the signer roles: the
 *    one left open is the signer's; the others have a preassigned recipient who counter-signs, assigned),
 *    fields ({ apiId, type, placeholder }), problems (why it can't be signed yet; empty when ready), checkedTs
 *  - text fields whose API id is a merge field name are filled in when a document is requested (../event/request)
 */
const STATUSES = {
    ACTIVE: { description: 'can be chosen and signed' },
    ARCHIVED: { description: 'no longer offered; kept for the documents signed from it' },
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
            default: 'ACTIVE'
        },
        name: {
            type: 'string',
            description: 'what the template is used for, e.g. hr.employee.agreement'
        },
        title: 'string',
        isDefault: 'boolean',
        service: 'string',
        serviceTemplateId: 'string',
        serviceStatus: {
            type: 'string',
            description: 'the status the service last reported, e.g. Created (draft) or Available'
        },
        editUrl: {
            type: 'string',
            description: "where the template is edited in the service's own editor"
        },
        placeholders: {
            type: 'array',
            description: 'the signer roles: [{ id, name, assigned: { name, email } }] - assigned for a preassigned recipient (a cosigner)'
        },
        fields: {
            type: 'array',
            description: 'the fields on the template: [{ apiId, type, placeholder }]'
        },
        problems: {
            type: 'array',
            description: 'why documents cannot be signed from it yet (empty when ready)'
        },
        checkedTs: 'timestamp',
        addedBy: 'string',
        archivedTs: 'timestamp',
    },

    workflow: {
        statuses: STATUSES
    }
}

/**
 * Whether documents can be signed from a template (a state or a snapshot)
 */
function ready(template) {
    const t$ = typeof template.snapshotPartial === 'function' ? template.snapshotPartial(['status', 'problems', 'checkedTs']) : template;

    return t$.status === 'ACTIVE' && !!t$.checkedTs && (t$.problems || []).length === 0;
}

module.exports = {
    TYPE,
    STATUSES,
    model,
    ready,
    materialize: session$ => javascript.materialize(session$, model)
}
