const { createUpdate } = require('gell-promote/gell-session/util/event');

const application = require('gell-promote/gell-namespace/domain/application');

const __metadata = {
    name: 'namespace.application.update',
    description: 'updates an APPLICATION attribute',
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

module.exports = createUpdate(__metadata, application);
