const assert = require('assert');
const _ = require('lodash');

const { State } = require('gell');
const { isIterator } = require('gell/util');

/**
 * Separates an extension name from an inherited event name in a stereotyped route:
 *      APPLICATION$namespace.create#action
 *
 * WIP: "$" already has a meaning in gell names ($name: future/bus, name$: snapshot); "~" is an alternative that
 * is unused in gell names and never encoded in URLs (APPLICATION~namespace.create#action)
 */
const DELIMITER = '$';

/**
 * Returns the stereotypes def extends (none, one, or many), resolving stereotype names through the registry
 */
function basesOf(def, stereotypes) {
    const { extends: xtends } = def;

    if (!xtends) return [];

    return (_.isArray(xtends) ? xtends : [xtends])
        .map(base => _.isString(base) ? stereotypes.get(base) : base)
        .filter(Boolean);
}

/**
 * Finds an event module declared by def (an extension or stereotype) in its catalog ("actions" or "snapshots")
 *
 * NOTE: a catalog is an array of event modules, matched by __metadata.name
 */
function declaredEvent(def, eventName, catalog) {
    const modules = def[catalog] || [];

    return modules.find(m => m.__metadata && m.__metadata.name === eventName);
}

/**
 * Finds the event an extension inherits: the extension's own declaration wins, then its stereotypes are searched
 * depth first, in the order they are extended
 *
 * WIP: an extension of several stereotypes that declare the same event resolves to the first one found; chaining
 * the steps of each stereotype (e.g. a RESERVATION create running workflow then schedulable) is not implemented
 */
function inheritedEvent(def, eventName, catalog, stereotypes, visited=new Set()) {
    if (visited.has(def)) return;
    visited.add(def);

    const module = declaredEvent(def, eventName, catalog);

    if (module) return { stereotype: def, module };

    for (const base of basesOf(def, stereotypes)) {
        const found = inheritedEvent(base, eventName, catalog, stereotypes, visited);

        if (found) return found;
    }
}

/**
 * Wraps an inherited trigger so it is invoked with extension specific information in its context
 *
 * NOTE: the context is copied, so the caller's context object is not modified; middleware has already run, so the
 * copy carries whatever it added (e.g. $txn)
 *
 * WIP: only the extension and the stereotype that declared the event are passed; the extension's configuration
 * (TYPE, parent, ...) is read from context.extension by the stereotype's handlers
 */
function wrapTrigger(triggerF, extension, stereotype) {
    return function(event) {
        return triggerF({
            ...event,
            context: {
                ...event.context,
                extension,
                stereotype,
            }
        });
    }
}

/**
 * Resolver for buses that routes stereotyped events to the implementation an extension inherits; all other
 * routes go to $fallback (e.g. gell-session/dispatch/resolver.object)
 *
 * Yields the same [resource, components, names] triple as gell-session resolvers:
 *  - resource: the inherited event module, with its __metadata renamed to the stereotyped route, so the bus and its
 *    middleware validate params, context, and transactions with the inherited trigger's spec
 *  - components.f: the requested trigger of the inherited module, wrapped (see wrapTrigger)
 *  - names: { resource: 'APPLICATION$namespace.create', f: 'action' }
 *
 * Extensions are looked up in the "stereotypes" dependency (optional) on every resolution, so a registry defined
 * after the bus was built is used
 *
 * WIP: resolved modules are rebuilt on every call; cache them per route if this becomes hot
 *
 * @param {*} $fallback resolver for regular (non stereotyped) routes
 * @param {*} deps container that defines the stereotypes registry
 * @param {*} options.catalog the stereotype catalog to search: 'actions' or 'snapshots'
 */
exports.resolver = function*($fallback, deps, { catalog='actions', delimiter=DELIMITER }={}) {
    assert(isIterator($fallback), '$fallback resolver is required');
    assert(deps, 'deps is required');
    assert(['actions', 'snapshots'].includes(catalog), 'catalog must be actions or snapshots');

    function resolve(route) {
        const [resourceName, functionName] = route.split('#');

        const names = { resource: resourceName, f: functionName };
        const notFound = [undefined, {}, names];

        const at = resourceName.indexOf(delimiter);
        const extensionName = resourceName.slice(0, at);
        const eventName = resourceName.slice(at + delimiter.length);

        const stereotypes = deps.resolveSingle({ name: 'stereotypes', optional: true });
        if (!stereotypes) return notFound;

        const extension = stereotypes.get(extensionName);
        if (!extension) return notFound;

        const found = inheritedEvent(extension, eventName, catalog, stereotypes);
        if (!found) return notFound;

        const { stereotype, module } = found;

        const triggerF = functionName ? module[functionName] : undefined;
        const f = _.isFunction(triggerF) ? wrapTrigger(triggerF, extension, stereotype) : undefined;

        const resource = {
            ...module,
            __metadata: {
                ...module.__metadata,
                name: resourceName,
                extension: extension.name,
                stereotype: stereotype.name,
                inherits: eventName,
            },
        };

        if (f) resource[functionName] = f;

        return [resource, { resource, f }, names];
    }

    let name = yield new State();

    while (true) {
        if (_.isString(name) && name.split('#')[0].includes(delimiter)) name = yield resolve(name);
        else if (_.isString(name)) name = yield $fallback.next(name).value;
        else name = yield;
    }
}

exports.DELIMITER = DELIMITER;
