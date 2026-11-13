const templates = require('../lib/templates');

/**
 * The email templates configured in SendGrid (dynamic and legacy), by name
 *  - returns { templates: [{ id, name, generation, updatedAt, versions (count), active: { id, name, subject, updatedAt,
 *    thumbnailUrl, editor } }] }, or { templates: [], unavailable } with the reason they can't be read (no API key,
 *    or a key without Template Engine read access) - so the page can say what to fix
 *  - gell modules don't define application roles: register with gell-dispatch/util/restrict
 */
exports.__metadata = {
    name: 'mail.templates',
    description: 'lists the email templates configured in SendGrid',
    triggers: {
        api: {
            params: {}
        }
    }
}

function version(v$) {
    if (!v$) return undefined;

    return { id: v$.id, name: v$.name, subject: v$.subject, updatedAt: v$.updated_at, thumbnailUrl: v$.thumbnail_url, editor: v$.editor };
}

exports.api = async function({ deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="mail.templates")');

    try {
        const templates$ = await templates.list(deps);

        return {
            templates: templates$
                .map(t$ => ({
                    id: t$.id,
                    name: t$.name,
                    generation: t$.generation || 'legacy',
                    updatedAt: t$.updated_at,
                    versions: (t$.versions || []).length,
                    active: version(t$.active),
                }))
                .sort((t1, t2) => String(t1.name).localeCompare(String(t2.name)))
        };
    } catch (e) {
        if (!(e instanceof templates.Unavailable)) throw e;

        logger.warn(`email templates unavailable (message=${e.message})`);

        return { templates: [], unavailable: e.message };
    }
}
