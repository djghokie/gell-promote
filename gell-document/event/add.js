const template = require('../domain/template');
const { invalid } = require('../lib/errors');
const templates = require('../snapshot/templates');
const { apply } = require('./refresh');

/**
 * Adds a template from the e-signature service for documents of a name
 *  - params.name: what it is used for (e.g. 'hr.employee.agreement'); params.title: what people call it
 *  - either params.file (base64) with params.filename: a new draft template is created at the service from
 *    the file, with one signer role (params.placeholder, default 'Signer'), to finish in its editor (editUrl)
 *  - or params.serviceTemplateId: a template already built at the service
 *  - params.addedBy (optional): who added it
 *  - the first ACTIVE template of a name becomes the default
 *  - context.$txn; returns the DOCUMENT#TEMPLATE state, checked (see ./refresh)
 */
exports.__metadata = {
    name: 'document.template.add',
    description: 'adds a template from the e-signature service',
    triggers: {
        effect: {
            params: {
                name: 'string',
                title: 'string',
                file: { type: 'string', optional: true },
                filename: { type: 'string', optional: true },
                serviceTemplateId: { type: 'string', optional: true },
                placeholder: { type: 'string', optional: true },
                addedBy: { type: 'string', optional: true },
            },
            context: {
                $txn: 'state'
            }
        }
    }
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger, signing } = deps.resolve('logger', 'signing');
    const { $txn } = context;

    logger.info('executing effect (name="document.template.add")');

    const { name, file, filename, placeholder='Signer', addedBy } = params;
    const title = (params.title || '').trim();
    const serviceTemplateId = (params.serviceTemplateId || '').trim();

    if (!title) throw invalid('the template needs a name');
    if (!file === !serviceTemplateId) throw invalid('upload a file or give the id of a template at the e-signature service');

    const templates_ = await templates.effect({ params: { name }, deps });

    let described;

    if (serviceTemplateId) {
        if (templates_.some(t_ => t_.snapshotAttribute('serviceTemplateId') === serviceTemplateId)) {
            throw invalid('that template was already added');
        }

        described = await signing.template(serviceTemplateId);

        if (!described) throw invalid(`no template with id ${serviceTemplateId} at the e-signature service`);
    } else {
        described = await signing.createTemplate({ name: title, filename: filename || 'document.pdf', file: Buffer.from(file, 'base64'), placeholder });
    }

    const hasDefault = templates_.some(t_ => t_.snapshotAttribute('status') === 'ACTIVE' && t_.snapshotAttribute('isDefault'));

    const template_ = template.materialize({
        name,
        title,
        status: 'ACTIVE',
        isDefault: !hasDefault,
        service: signing.name,
        serviceTemplateId: described.id,
        ...(addedBy ? { addedBy } : {}),
    });

    apply(template_, described);

    $txn.next({ operation: 'put', item: template_ });

    logger.info(`added document template (id=${template_.snapshotAttribute('id')}; name=${name}; serviceTemplateId=${described.id})`);

    return template_;
}
