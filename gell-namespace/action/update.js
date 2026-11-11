const { createUpdate } = require('gell-promote/gell-session/util/event');

const tenant = require('gell-promote/gell-namespace/domain/tenant');

/**
 * NOTE: updates one editable attribute (name, namespaceId) per call; the lookup uses the namespaced type
 * NOTE: TENANT ids are generated uuids, but TENANTs created before that keep readable keys, so id is a string
 */
const __metadata = {
    name: 'tenant.update',
    description: 'updates a TENANT attribute',
    triggers: {
        action: {
            params: {
                id: 'string',
                attribute: 'string',
                value: 'any'
            },
            transaction: 'NEW'
        }
    }
}

module.exports = createUpdate(__metadata, tenant);
