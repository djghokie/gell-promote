const assert = require('assert');
const _ = require('lodash');

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
 * @param {*} type 
 * @param {*} parent$ 
 * @param {*} defaults 
 * @param {*} $txn 
 * @param {*} deps 
 * @returns 
 */
async function doInitiate(type, parent$, defaults, $txn, deps) {
    const types = deps.resolveSingle('types');

    const namespace_ = types.instance(type, {
        ...defaults,
        parentId: parent$.id,
        status: 'ACTIVE'
    });

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
 * NOTE: the stereotype resolver puts the extension in context.extension; the extension provides the TYPE and the
 * context attribute that holds the parent namespace (parentContext)
 */
exports.action = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing action (name="namespace.create")');

    const { extension, $txn } = context;
    assert(extension, 'extension is required; dispatch as <EXTENSION>$namespace.create#action');
    assert(extension.TYPE, `extension (name=${extension.name}) must define TYPE`);

    const { relativeId } = params;
    assert(_.isString(relativeId), 'relativeId (relative namespace) is required');

    const parentContext = extension.parentContext || 'parent_';
    const parent_ = context[parentContext];
    assert(parent_, `parent is required (context=${parentContext})`);

    return doInitiate(extension.TYPE, parent_.snapshotPartial(['id']), params, $txn, deps);
}
