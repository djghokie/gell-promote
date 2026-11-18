const _ = require('lodash');

const format = require('gell/state/format');

const ErrorState = require('../../gell/error');

const { resolveType } = require('../util/extension');

const MESSAGE_EXTENSION_REQUIRED = 'call to event trigger (route="%s") must be dispatched for an extension (e.g. EXTENSION$%s)';
const MESSAGE_EXTENSION_TYPE = 'extension (name="%s") does not extend type (name="%s") for event trigger (route="%s")';
const MESSAGE_EXTENSION_ATTRIBUTE = 'extension (name="%s") does not provide required attribute (name="%s") for event trigger (route="%s")';
const MESSAGE_EXTENSION_ATTRIBUTE_TYPE = 'extension (name="%s") has attribute (name="%s") that is not of type (type="%s") for event trigger (route="%s")';

function fail(name, attributes, message, ...keys) {
    const e = new ErrorState();

    e.set('name', name);
    Object.entries(attributes).forEach(([k, v]) => e.set(k, v));
    e.set('message', format(message, ...keys));

    e.throw();
}

/**
 * gell-dispatch middleware for stereotyped events (EXTENSION$stereotype.event#trigger, see dispatch/resolver)
 *  - puts the extension, and the stereotype that declared the event, in context.extension and context.stereotype
 *  - resolves the extension's types for the stereotype types the trigger operates on into context.extensionTypes,
 *    keyed by stereotype type name: { 'GELL#NAMESPACE': { name: 'NAMESPACE#APPLICATION', model } }
 *  - validates the extension against the trigger's extension spec:
 *
 *      triggers: {
 *          action: {
 *              params: { ... },
 *              extension: {
 *                  // stereotype types the extension must extend (see domain/extension)
 *                  types: ['GELL#NAMESPACE'],
 *                  // configuration attributes the extension provides
 *                  attributes: {
 *                      parentContext: { type: 'string', optional: true },
 *                  },
 *              },
 *          }
 *      }
 *
 * A trigger that declares an extension spec can only be dispatched as a stereotyped event, so its handler can rely
 * on context.extension and context.extensionTypes
 *
 * NOTE: the context is copied, so the caller's context object is not modified
 *
 * NOTE: runs before the attributes middleware, so context specs can require extension and stereotype
 *
 * WIP: type checks support 'string' only, like the arguments middleware
 *
 * WIP: extension types are resolved on every invocation; cache them per extension if this becomes hot
 */
module.exports = function(event, resume) {
    const { __invocationSpec } = event;

    if (!__invocationSpec) return resume(event);

    const { route, eventName, triggerSpec={}, metadata={} } = __invocationSpec;
    const { extension, stereotype } = metadata;
    const spec = triggerSpec.extension;

    if (spec && !extension) {
        fail('ExtensionRequiredError', { route, eventName }, MESSAGE_EXTENSION_REQUIRED, 'route', 'eventName');
    }

    if (!extension) return resume(event);

    const { types: typeNames=[], attributes: attributeSpecs={} } = spec || {};

    const stereotypes = event.deps && event.deps.resolveSingle({ name: 'stereotypes', optional: true });

    const extensionTypes = {};

    typeNames.forEach(typeName => {
        const type = resolveType(extension, typeName, stereotypes);

        if (!type || type.abstract) {
            fail('ExtensionTypeError', { route, extension: extension.name, typeName }, MESSAGE_EXTENSION_TYPE,
                'extension', 'typeName', 'route');
        }

        extensionTypes[typeName] = { name: type.name, model: type.model };
    });

    Object.keys(attributeSpecs).forEach(n => {
        const attr = attributeSpecs[n] || {};
        const val = extension[n];
        const attributes = { route, eventName, extension: extension.name, attribute: n };

        if (val === undefined) {
            if (attr.optional) return;

            fail('ExtensionAttributeError', attributes, MESSAGE_EXTENSION_ATTRIBUTE, 'extension', 'attribute', 'route');
        }

        if (attr.type === 'string' && !_.isString(val)) {
            fail('ExtensionAttributeError', { ...attributes, type: attr.type }, MESSAGE_EXTENSION_ATTRIBUTE_TYPE,
                'extension', 'attribute', 'type', 'route');
        }
    });

    return resume({
        ...event,
        context: {
            ...event.context,
            extension,
            stereotype,
            extensionTypes,
        }
    });
}
