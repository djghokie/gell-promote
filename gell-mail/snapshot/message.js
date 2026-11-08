const lookup = require('gell-session/snapshot/lookup');

const message = require('../domain/message');

/**
 * One MAIL#MESSAGE in full, including the message as it was sent
 *  - gell modules don't define application roles: register with gell-dispatch/util/restrict
 */
exports.__metadata = {
    name: 'mail.message',
    description: 'returns one email, including its content',
    triggers: {
        api: {
            params: {
                id: 'uuid',
            }
        }
    }
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="mail.message")');

    const message_ = await lookup.effect({
        params: { key: { type: message.TYPE, id: params.id } },
        context: { materialize: message.materialize },
        deps
    });

    return message_ ? message_.snapshot() : null;
}
