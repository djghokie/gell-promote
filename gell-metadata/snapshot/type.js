const assert = require('assert');

const compiler = require('gell-domain/binding/compiler');

exports.__metadata = {
    name: 'gell.domain.type',
    description: 'returns a registered domain TYPE by name',
    triggers: {
        effect: {
            params: { name: 'string' }
        },
        api: {
            params: { name: 'string' }
        }
    }
}

// NOTE: gell-session's base model has no name, so fall back to its class name (Session)
function modelName(model) {
    return model.name || (model.class && model.class.name) || '—';
}

function baseModels(model) {
    const { extends: xtends } = model;

    if (!xtends) return [];

    return Array.isArray(xtends) ? xtends : [xtends];
}

/**
 * normalizes an attribute spec with gell-domain's compiler, then adds what the compiler doesn't keep
 */
function describeAttribute(key, spec, source) {
    const { name, type, default: defaultValue, derive } = compiler.attribute(key, spec);

    const attribute$ = { name };

    if (type !== undefined) attribute$.type = type;

    if (derive || typeof defaultValue === 'function') attribute$.computed = true;
    else if (defaultValue !== undefined) attribute$.default = defaultValue;

    attribute$.source = source;

    if (spec && typeof spec === 'object') {
        if (spec.description) attribute$.description = spec.description;
        if (spec.deprecated) attribute$.deprecated = true;
    }

    return attribute$;
}

/**
 * collects attributes base-first so a model's own attributes override the ones it inherits
 *
 * NOTE: mirrors gell-domain compiler.compileAttributes, which can't be used directly: it drops which model
 * defined each attribute (and description/deprecated), and throws NYI for more than one base model
 */
function collectAttributes(model, attributes={}) {
    baseModels(model).forEach(base => collectAttributes(base, attributes));

    const source = modelName(model);
    const { attributes: specs={} } = model;

    const described = Array.isArray(specs)
        ? specs.map(spec => describeAttribute(null, spec, source))
        : Object.entries(specs).map(([key, spec]) => describeAttribute(key, spec, source));

    described.forEach(attribute$ => attributes[attribute$.name] = attribute$);

    return attributes;
}

/**
 * WIP: move this into gell-domain so the snapshot can just call compiler.describe(model)
 *  - compiler.describe would need: per-attribute source, description/deprecated pass-through,
 *    a stable id (it currently falls back to a random uuid), and support for multiple base models
 */
function describeModel(model) {
    return {
        name: modelName(model),
        extends: baseModels(model).map(modelName),
        attributes: Object.values(collectAttributes(model)),
    };
}

exports.describeModel = describeModel;

function doDescribe(name, deps) {
    const { logger } = deps.resolve('logger');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    logger.info('executing effect (name="gell.domain.type")');

    const model$ = types && types.snapshotAttribute(name);

    return compiler.describe(model$);
}

/**
 * WIP: compiles the TYPE from its module on each call
 *  - registry_.registerType should compile it once (see gell-discover registry WIP)
 */
exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    logger.info('executing effect (name="gell.domain.type")');

    const { name } = params;

    assert(name, 'name is required');

    // NOTE: without the types registry no TYPE is registered
    const model$ = types && types.snapshotAttribute(name);

    if (model$) return { ...describeModel(model$), name };
}

/**
 * NOTE: gell-http's api wrapper crashes on an empty result, so a missing TYPE is reported as a 404 instead
 */
exports.api = async function({ params={}, deps }) {
    const type$ = await exports.effect({ params, deps });

    if (!type$) throw Object.assign(new Error(`type not found (name=${params.name})`), { status: 404 });

    return type$;
}
