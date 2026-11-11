const javascript = require('gell-domain/binding/javascript');
const session = require('gell-session/domain/session');

const tenant = require('../../../gell-namespace/domain/tenant');

const TYPE = 'WEB#MEMBER';

/**
 * Represents a USER's membership in a TENANT, and the USER's role in that TENANT
 *
 * NOTE: the USER is the identity (scoped to an APPLICATION); a USER can be a MEMBER of any number of TENANTs
 *  - parentId is the TENANT's id
 *  - userId is the USER's userId (typically email address)
 *  - one role per MEMBER; a USER can have a different role in each TENANT
 *  - the type is namespaced by the APPLICATION, so all MEMBERs of an APPLICATION share a partition
 *
 * WIP: no status workflow yet; a MEMBER is current while it is active (activeTs)
 *  - removing a MEMBER would deactivate it
 */
const model = {
    name: TYPE,
    extends: [session.model],
    parent: tenant,
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        role: {
            type: 'string',
            editable: true
        },
    }
}

module.exports = {
    TYPE,
    model,
    materialize: member$ => javascript.materialize(member$, model)
}
