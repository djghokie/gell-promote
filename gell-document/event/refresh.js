/**
 * Checks a template against the e-signature service and records what the service reports
 *  - context.template_: the DOCUMENT#TEMPLATE; context.$txn
 *  - records serviceStatus, editUrl, placeholders, fields, checkedTs, and problems: why documents can't be
 *    signed from it yet (see check) - empty when it is ready
 *  - returns the template state, put in $txn
 */
exports.__metadata = {
    name: 'document.template.refresh',
    description: 'checks a document template against the e-signature service',
    triggers: {
        effect: {
            context: {
                template_: 'state',
                $txn: 'state'
            }
        }
    }
}

// the service's status of a template that is ready to use (a draft is 'Created')
const AVAILABLE = 'available';

/**
 * Why documents can't be signed from a template the service described (see ../service/signwell), [] when ready
 *  - undefined: the service has no such template
 */
function check(described) {
    if (!described) return ['not found at the e-signature service - it may have been deleted there'];

    const problems = [];
    const { status, archived, placeholders=[], fields=[] } = described;

    if (archived) problems.push('archived at the e-signature service');
    // WIP: 'Created' for a draft and 'Available' once finished are from SignWell's API reference examples
    if (String(status || '').toLowerCase() !== AVAILABLE) problems.push(`still a draft at the e-signature service (status ${status || 'unknown'}) - finish it in the editor`);
    if (placeholders.length !== 1) problems.push(`needs exactly one signer role (it has ${placeholders.length})`);
    if (!fields.some(f => f.type === 'signature')) problems.push('has no signature field');

    return problems;
}

/**
 * Sets what the service described on a template state (no put)
 */
function apply(template_, described) {
    const problems = check(described);

    if (described) {
        template_.set('serviceStatus', described.status);
        if (described.editUrl) template_.set('editUrl', described.editUrl);
        template_.set('placeholders', described.placeholders);
        template_.set('fields', described.fields);
    }
    template_.set('problems', problems);
    template_.set('checkedTs', Date.now());

    return template_;
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger, signing } = deps.resolve('logger', 'signing');
    const { template_, $txn } = context;

    logger.info('executing effect (name="document.template.refresh")');

    const described = await signing.template(template_.snapshotAttribute('serviceTemplateId'));

    apply(template_, described);

    $txn.next({ operation: 'put', item: template_ });

    logger.info(`checked document template (id=${template_.snapshotAttribute('id')}; problems=${template_.snapshotAttribute('problems').length})`);

    return template_;
}

exports.check = check;
exports.apply = apply;
