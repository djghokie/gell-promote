const { createUpdate } = require('gell-promote/gell-session/util/event');

const tenant = require('gell-promote/gell-namespace/domain/tenant');

const __metadata = {
    name: 'namespace.tenant.update',
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
