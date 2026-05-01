const assert = require('assert');
const EventEmitter = require('events');

const { State } = require('gell');

/**
 * Associates the tenant with the session
 * 
 * WIP: number of problems with this approach currently
 *  - application user is not associated with the tenant
 *      - current scheme uses applicationId/email (identity) as the key in the database
 *      - no parentId currently is set
 *          - tenant seems like the logical choice here
 *              - in fact, this may not make a lot of sense
 *              - no reason to query "all users with tenant x as the parent"
 *          - instead of tenant, APPLICATION could be the parent
 *              - not sure this is actually a type in the system
 *      - probably makes sense to just set tenant information right on the user
 *          - not parentId/other indexed attribute
 *          - tenantId: may be all that is needed
 *          - tenant complex object
 *  - tenant id *may* be embedded in the applicationId
 *      - applicationId is TENANT#APP#APPNAME
 *      - this may be inadvertent
 *  - if applicationId is common across all tenants, identity can't be associated with multiple tenants
 *      - might not really be an issue
 *      - probably not a good design
 *  - only way currently to pass tenant information to events is through caller (the session)
 *      - that is, if we use API middleware (as implemented below)
 *      - bus middleware (not currently available) may be the better solution
 *  - for now, going with the poor man approach
 *      - hard code tenant key for lookup
 *      - associate tenant with session
 *  - obviously this will have to be revisted for a true multi tenant setup
 * 
 * @param {*} tenantKey 
 */
module.exports = function* tenantLoader(tenantKey) {
	const state = new State();
	const conf = new State();
	const events = new EventEmitter();

	async function bindTenant(context) {
        assert(context, 'request context is required');

        const { session, deps } = context;

        const userId = session.snapshotAttribute();
        const { store } = deps.resolve('store');

        const tenant$ = await store.lookup(tenantKey);
        assert(tenant$, `no tenant associated with user (id=${userId})`);

        session.set('tenant', tenant$);
	}

	let args = yield { state, conf, events };

	while (true) args = yield bindTenant(args);
}

