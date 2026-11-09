const templates = require('./templates');

/**
 * The PUBLISHED version of a document template (undefined until one is published)
 *  - params.name: the template name
 */
exports.__metadata = {
    name: 'document.template.current',
    description: 'returns the published version of a document template',
    triggers: {
        effect: {
            params: {
                name: 'string',
            }
        }
    }
}

exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="document.template.current")');

    const templates_ = await templates.effect({ params: { name: params.name }, deps });

    return templates_.find(t_ => t_.snapshotAttribute('status') === 'PUBLISHED');
}
