const javascript = require('gell-domain/binding/javascript');
const session = require('gell-session/domain/session');

const TYPE = 'MAIL#MESSAGE';

/**
 * An email queued in the same transaction as the change it reports (the outbox)
 *  - written by mail.message.queue inside the caller's $txn, so it only exists if the transaction commits
 *  - delivered by mail.message.deliver: the mailer Lambda on the session table stream (INSERT of this type),
 *    or the mail.flush job for anything still QUEUED
 *  - parentId/parentType: the record the email is about (an employee FILE, an ITINERARY); more records
 *    are associated with MAIL#REFERENCE items (see ./reference)
 *  - message is the rendered SendGrid payload (personalizations, from, subject, content or template_id)
 *  - attachments are references to stored files ({ storage, key, filename, type }), read when the message is
 *    delivered - the file itself is never stored on the message
 *  - activeTs is set while QUEUED, so queued messages are found with the sessions.active.type query
 *  - CANCELED: an operator stopped a QUEUED message (mail.message.cancel); nothing delivers it after that
 */
const STATUSES = {
    QUEUED: { description: 'waiting to be sent' },
    SENT: { description: 'accepted by SendGrid' },
    FAILED: { description: 'gave up after MAX_ATTEMPTS sends failed' },
    CANCELED: { description: 'canceled by an operator before it was sent' },
};

const MAX_ATTEMPTS = 5;

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
            default: 'QUEUED'
        },
        name: {
            type: 'string',
            description: 'which email this is, usually the name of the event that queued it (e.g. hr.employee.invitation.email)'
        },
        parentType: 'string',
        message: {
            type: 'object',
            description: 'the SendGrid message to send'
        },
        to: {
            type: 'array',
            description: 'recipient addresses, for listing'
        },
        attachments: {
            type: 'array',
            description: 'files attached when it is sent: { storage (the dependency holding it, with get(key)), key, filename, type }'
        },
        subject: {
            type: 'string',
            description: 'subject (or template id of a dynamic template), for listing'
        },
        attempts: 'number',
        error: 'string',
        sentTs: 'timestamp',
        failedTs: 'timestamp',
        canceledTs: 'timestamp',
        canceledBy: {
            type: 'string',
            description: 'userId of who canceled it'
        },
        retainDays: {
            type: 'number',
            description: 'when set, the message expires (ttl) this many days after it is sent; kept with its parent otherwise'
        },
        ttl: {
            type: 'number',
            description: 'DynamoDB time to live (epoch seconds)'
        },
        purgedOn: {
            type: 'string',
            description: 'YYYY-MM-DD the content was removed with its parent record (retention)'
        },
    },

    workflow: {
        statuses: STATUSES
    }
}

module.exports = {
    TYPE,
    STATUSES,
    MAX_ATTEMPTS,
    model,
    materialize: session$ => javascript.materialize(session$, model)
}
