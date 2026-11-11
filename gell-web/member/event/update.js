const { createUpdate } = require('../../../gell-session/util/event');

const member = require('../domain/member');

const __metadata = {
    name: 'web.member.update',
    description: 'updates a MEMBER attribute (role)',
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

module.exports = createUpdate(__metadata, member);
