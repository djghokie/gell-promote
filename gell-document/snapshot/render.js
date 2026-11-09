const { render } = require('../lib/render');
const current = require('./current');

/**
 * A document template filled in with merge field values
 *  - params.name: the template name; params.values: { field: value } (already formatted for reading)
 *  - context.template_ (optional): the template version to render; the PUBLISHED version otherwise
 *  - returns { template_, title, text }, or undefined when no version is published
 */
exports.__metadata = {
    name: 'document.render',
    description: 'fills in a document template with merge field values',
    triggers: {
        effect: {
            params: {
                name: 'string',
                values: 'object',
            }
        }
    }
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="document.render")');

    const template_ = context.template_ || await current.effect({ params: { name: params.name }, deps });

    if (!template_) return undefined;

    const { title, body } = template_.snapshotPartial(['title', 'body']);

    return {
        template_,
        title,
        text: render(body, params.values),
    };
}
