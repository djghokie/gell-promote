const update = require('gell-session/event/update');

const { unknownFields } = require('../lib/render');
const { invalid } = require('../lib/errors');
const templates = require('../snapshot/templates');

/**
 * Publishes the DRAFT version of a document template and RETIRES the published one
 *  - params.name: the template name
 *  - params.fields (optional): the allowed merge fields ({ field: description }); unknown fields are refused
 *  - params.publishedBy (optional): who published it, e.g. the caller's userId
 *  - params.label (optional): what the document is called in error messages (default 'document')
 *  - context.$txn: the caller's transaction
 */
exports.__metadata = {
    name: 'document.template.publish',
    description: 'publishes the DRAFT version of a document template and retires the published one',
    triggers: {
        effect: {
            params: {
                name: 'string',
                fields: { type: 'object', optional: true },
                publishedBy: { type: 'string', optional: true },
                label: { type: 'string', optional: true },
            },
            context: {
                $txn: 'state'
            }
        }
    }
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');
    const { $txn } = context;

    logger.info('executing effect (name="document.template.publish")');

    const { name, fields, publishedBy, label='document' } = params;

    const templates_ = await templates.effect({ params: { name }, deps });

    const draft_ = templates_.find(t_ => t_.snapshotAttribute('status') === 'DRAFT');
    if (!draft_) throw invalid(`there is no draft ${label} to publish`);

    const { version, title, body } = draft_.snapshotPartial(['version', 'title', 'body']);

    if (!title || !(body || '').trim()) throw invalid(`the ${label} needs a title and text`);

    if (fields) {
        const unknown = unknownFields(body, fields);

        if (unknown.length > 0) throw invalid(`unknown merge fields: ${unknown.map(f => `{{${f}}}`).join(', ')}`);
    }

    for (const published_ of templates_.filter(t_ => t_.snapshotAttribute('status') === 'PUBLISHED')) {
        await update.effect({
            params: { attribute: 'status', value: 'RETIRED' },
            context: { session_: published_, $txn },
            deps
        });
    }

    draft_.set('status', 'PUBLISHED');
    draft_.set('publishedTs', Date.now());
    if (publishedBy) draft_.set('publishedBy', publishedBy);

    $txn.next({ operation: 'put', item: draft_ });

    logger.info(`published document template (name=${name}; version=${version})`);

    return draft_;
}
