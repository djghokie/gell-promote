const templates = require('../lib/templates');

/**
 * One SendGrid template with the content of its active version (subject, HTML, plain text, test data)
 *  - params.id: the template id (d-... for a dynamic template)
 *  - returns { id, name, generation, updatedAt, versions: [{ id, name, active, updatedAt }], active: { id, name,
 *    subject, html, text, testData, updatedAt, editor } }, or { id, unavailable } when templates can't be read
 *  - gell modules don't define application roles: register with gell-dispatch/util/restrict
 */
exports.__metadata = {
    name: 'mail.template',
    description: 'returns one SendGrid email template with its active content',
    triggers: {
        api: {
            params: {
                id: 'string',
            }
        }
    }
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="mail.template")');

    try {
        const t$ = await templates.get(params.id, deps);
        const v$ = t$.active || {};

        return {
            id: t$.id,
            name: t$.name,
            generation: t$.generation || 'legacy',
            updatedAt: t$.updated_at,
            versions: (t$.versions || []).map(v => ({ id: v.id, name: v.name, active: v.active === 1 || v.active === true, updatedAt: v.updated_at })),
            active: t$.active ? {
                id: v$.id,
                name: v$.name,
                subject: v$.subject,
                html: v$.html_content,
                text: v$.plain_content,
                testData: v$.test_data,
                updatedAt: v$.updated_at,
                editor: v$.editor,
            } : undefined,
        };
    } catch (e) {
        if (!(e instanceof templates.Unavailable)) throw e;

        logger.warn(`email template unavailable (id=${params.id}; message=${e.message})`);

        return { id: params.id, unavailable: e.message };
    }
}
