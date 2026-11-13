/**
 * SendGrid templates (Template Engine API) through the `mail` dependency's client (@sendgrid/mail's client)
 *  - the API key needs Template Engine read access; a key with Mail Send only is refused (403)
 *  - unavailable(): the reason templates can't be read (no key, key refused) - reported to the caller rather
 *    than thrown, so a page can say what to fix
 */
const PAGE_SIZE = 200;

class Unavailable extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'TemplatesUnavailable';
        this.status = status;
    }
}

function client(deps) {
    const NOT_CONFIGURED = 'SendGrid is not configured (SENDGRID_KEY is not set)';
    let mail;

    // NOTE: a factory that failed (no key) throws the first time and resolves undefined after that
    try {
        mail = deps.resolveSingle('mail');
    } catch (e) {
        throw new Unavailable(NOT_CONFIGURED);
    }

    if (!mail) throw new Unavailable(NOT_CONFIGURED);
    if (!mail.client || typeof mail.client.request !== 'function') throw new Unavailable('the mail dependency has no SendGrid client');

    return mail.client;
}

async function request(deps, options) {
    try {
        const [response] = await client(deps).request({ method: 'GET', ...options });
        return response.body;
    } catch (e) {
        if (e instanceof Unavailable) throw e;

        const status = e.code || (e.response && e.response.statusCode);

        if (status === 401 || status === 403) {
            throw new Unavailable('the SendGrid API key can\'t read templates - give it Template Engine read access (SendGrid: Settings > API Keys)', status);
        }

        throw e;
    }
}

function activeVersion(template$) {
    const versions = template$.versions || [];

    return versions.find(v => v.active === 1 || v.active === true) || versions[0];
}

/**
 * Every template (dynamic and legacy), by name
 *  - WIP: one page of PAGE_SIZE - follow _metadata.next if the account ever has more
 */
async function list(deps) {
    const body = await request(deps, { url: '/v3/templates', qs: { generations: 'legacy,dynamic', page_size: PAGE_SIZE } });

    return (body.result || body.templates || []).map(t$ => ({ ...t$, active: activeVersion(t$) }));
}

async function get(id, deps) {
    const body = await request(deps, { url: `/v3/templates/${encodeURIComponent(id)}` });

    return { ...body, active: activeVersion(body) };
}

module.exports = {
    Unavailable,
    list,
    get,
};
