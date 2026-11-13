const _ = require('lodash');

const message = require('../domain/message');
const reference = require('../domain/reference');

const SUMMARY = ['id', 'name', 'status', 'to', 'subject', 'attempts', 'error', 'initiatedTs', 'sentTs', 'failedTs', 'canceledTs', 'canceledBy', 'purgedOn', 'parentId', 'parentType'];

/**
 * The emails about a record, newest first - its own MAIL#MESSAGEs and those associated with it by MAIL#REFERENCE
 *  - params.parentId: the record (an employee FILE, an ITINERARY, ...)
 *  - returns summaries without the message content (see ./message for one message in full)
 *  - gell modules don't define application roles: register with gell-dispatch/util/restrict
 */
exports.__metadata = {
    name: 'mail.messages',
    description: 'lists the emails sent about a record',
    triggers: {
        effect: {
            params: {
                parentId: 'uuid',
            }
        },
        api: {
            params: {
                parentId: 'uuid',
            }
        }
    }
}

async function messages(parentId, deps) {
    const { store } = deps.resolve('store');

    const [own$, references$] = await Promise.all([
        store.drain('session.children', { type: message.TYPE, parentId }),
        store.drain('session.children', { type: reference.TYPE, parentId }),
    ]);

    const ownIds = new Set(own$.map(m$ => m$.id));
    const referenced = _.uniq(references$.map(r$ => r$.messageId)).filter(id => !ownIds.has(id));

    const referenced$ = (await Promise.all(referenced.map(id => store.lookup({ type: message.TYPE, id })))).filter(Boolean);

    return [...own$, ...referenced$]
        .sort((m1, m2) => (m2.initiatedTs || 0) - (m1.initiatedTs || 0))
        .map(summary);
}

/**
 * A MAIL#MESSAGE for listing: no content, attachment file names only
 */
function summary(m$) {
    return { ..._.pick(m$, SUMMARY), ...(m$.attachments ? { attachments: m$.attachments.map(a => a.filename) } : {}) };
}

exports.summary = summary;

exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="mail.messages")');

    return messages(params.parentId, deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="mail.messages")');

    return messages(params.parentId, deps);
}
