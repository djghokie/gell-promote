const assert = require('assert');
const _ = require('lodash');

const javascript = require('gell-domain/binding/javascript');
const activate = require('gell-session/event/activate');

exports.__metadata = {
    name: 'namespace.create',
    description: 'creates a NAMESPACE',
    triggers: {
        action: {
            params: {
                name: 'string',
                relativeId: 'string',
            },
            extension: {
                types: ['GELL#NAMESPACE'],
                attributes: {
                    parentContext: { type: 'string', optional: true },
                },
            },
            transaction: 'NEW'
        }
    },
};

/**
 * WIP: copied from gell-promote/gell-session/util/event
 *  - this implementation is meant for stereotypes
 *  - util doesnt work because you need to pin it to a type
 *      - this supports all namespace types
 * 
 * NOTE: a type registered with the types registry is instantiated through it (namespaced type); otherwise the
 * model (e.g. an extension type resolved by gell-stereotype's extension middleware) is materialized directly
 *
 * @param {*} type 
 * @param {*} parent$ 
 * @param {*} defaults 
 * @param {*} $txn 
 * @param {*} deps 
 * @param {*} model optional model for a type that is not registered
 * @returns 
 */
async function doInitiate(type, parent$, defaults, $txn, deps, model) {
    const types = deps.resolveSingle({ name: 'types', optional: true });

    const state$ = {
        ...defaults,
        parentId: parent$.id,
        status: 'ACTIVE'
    };

    let namespace_;

    if ((types && types.get(type)) || !model) namespace_ = types.instance(type, state$);
    else {
        namespace_ = javascript.materialize(state$, model);
        namespace_.set('type', type);
    }

	if ($txn) $txn.next({ operation: 'put', item: namespace_ });

    await activate.effect({
        context: {
            session_: namespace_,
        },
        deps
    });

// console.debug('#####', namespace_.snapshot());

    return namespace_;
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="namespace.create")');

    // NOTE: this is required, otherwise id will be undefined
    assert(_.isString(params.relativeId), 'relativeId (relative namespace) is required');

    // console.debug('#####', context);
    // console.debug('#####', params);

    const { type, parent_ } = context;
    assert(type, 'type is required');
    assert(parent_, 'parent_ is required');

    return doInitiate(type, parent_.snapshotPartial(['id']), params, context.$txn, deps);
}

/**
 * Invoked by user interfaces as a stereotyped event of a namespace extension (see stereotype/namespace.js):
 *      APPLICATION$namespace.create#action
 *
 * NOTE: gell-stereotype's extension middleware puts the extension in context.extension, and the extension's
 * GELL#NAMESPACE type (e.g. NAMESPACE#APPLICATION) in context.extensionTypes, validated against the trigger's
 * extension spec; the extension optionally provides the context attribute that holds the parent namespace
 * (parentContext)
 */
exports.action = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing action (name="namespace.create")');

    const { extension, extensionTypes, $txn } = context;
    const { name: type, model } = extensionTypes['GELL#NAMESPACE'];

    const { relativeId } = params;
    assert(_.isString(relativeId), 'relativeId (relative namespace) is required');

    const parentContext = extension.parentContext || 'parent_';
    const parent_ = context[parentContext];
    assert(parent_, `parent is required (context=${parentContext})`);

    return doInitiate(type, parent_.snapshotPartial(['id']), params, $txn, deps, model);
}
