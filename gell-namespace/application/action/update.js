const { createUpdate } = require('../../../gell-session/util/event');

const application = require('../../domain/application');

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
