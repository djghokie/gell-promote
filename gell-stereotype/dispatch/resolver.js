const assert = require('assert');
const _ = require('lodash');

const { State } = require('gell');

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
 * Resolves a regular route (e.g. namespace.create#action) in the resource map, like gell-session's resolver.object
 */
function resolveRegular(obj, resourceName, functionName, names) {
    const resource = obj[resourceName];
    const components = { resource };

    if (resource && functionName) components.f = resource[functionName];

    return [resource, components, names];
}

/**
 * Resolves a stereotyped route (e.g. APPLICATION$namespace.create#action) to the event the extension declares or
 * inherits, through the "stereotypes" dependency
 *
 *  - resource: the inherited event module, with its __metadata renamed to the stereotyped route, so the bus and its
 *    middleware validate params, context, and transactions with the inherited trigger's spec; __metadata.extension
 *    and __metadata.stereotype are the extension and the stereotype that declared the event (objects)
 *  - components.f: the requested trigger of the inherited module
 *
 * NOTE: the extension is put in the trigger's context by middleware/extension, which also validates it
 */
function resolveStereotyped(deps, catalog, delimiter, resourceName, functionName, names) {
    const notFound = [undefined, {}, names];

    const at = resourceName.indexOf(delimiter);
    const extensionName = resourceName.slice(0, at);
    const eventName = resourceName.slice(at + delimiter.length);

    const stereotypes = deps && deps.resolveSingle({ name: 'stereotypes', optional: true });
    if (!stereotypes) return notFound;

    const extension = stereotypes.get(extensionName);
    if (!extension) return notFound;

    const found = inheritedEvent(extension, eventName, catalog, stereotypes);
    if (!found) return notFound;

    const { stereotype, module } = found;

    const resource = {
        ...module,
        __metadata: {
            ...module.__metadata,
            name: resourceName,
            inherits: eventName,
            extension,
            stereotype,
        },
    };

    const f = functionName ? module[functionName] : undefined;

    return [resource, { resource, f }, names];
}

/**
 * Resolver for buses that handles both regular and stereotyped routes; a drop in replacement for gell-session's
 * resolver.object
 *  - regular routes (namespace.create#action) resolve in the resource map obj
 *  - stereotyped routes (APPLICATION$namespace.create#action) resolve to the event the extension declares or
 *    inherits from its stereotypes
 *
 * Yields the same [resource, components, names] triple as gell-session resolvers; names is
 *      { resource: 'APPLICATION$namespace.create', f: 'action' }
 *
 * Extensions are looked up in the "stereotypes" dependency (optional) on every resolution, so a registry defined
 * after the bus was built is used
 *
 * WIP: resolved stereotyped modules are rebuilt on every call; cache them per route if this becomes hot
 *
 * @param {*} obj resource map of regular events, by name (e.g. registry __events or __snapshots)
 * @param {*} options.deps container that defines the stereotypes registry; without it only regular routes resolve
 * @param {*} options.catalog the stereotype catalog to search: 'actions' or 'snapshots'
 */
exports.object = function*(obj, { deps, catalog='actions', delimiter=DELIMITER }={}) {
    assert(_.isObjectLike(obj), 'resource map (object) is required');
    assert(['actions', 'snapshots'].includes(catalog), 'catalog must be actions or snapshots');

    let name = yield new State();

    while (true) {
        if (_.isString(name)) {
            const [resourceName, functionName] = name.split('#');
            const names = { resource: resourceName, f: functionName };

            if (resourceName.includes(delimiter)) {
                name = yield resolveStereotyped(deps, catalog, delimiter, resourceName, functionName, names);
            }
            else name = yield resolveRegular(obj, resourceName, functionName, names);
        }
        else name = yield;
    }
}

exports.DELIMITER = DELIMITER;
