const assert = require('assert');

const runtime = require('gell-runtime/mocha');

const sessionQueries = require('gell-session/dynamodb/queries');
const activityQueries = require('gell-session/dynamodb/activity/queries');
const queryWrapper = require('gell-aws-dynamodb/query-wrapper');

const MockStore = require('../../../gell-aws-dynamodb/mock/store');
const { Types } = require('../../../gell-discover/domain/types');
const { Queries } = require('../../../gell-discover/domain/queries');

const tenant = require('../../../gell-namespace/domain/tenant');
const member = require('../../../gell-web/member/domain/member');
const tenantItems = require('../../../gell-namespace/tenant/snapshot/items');
const deleteTenant = require('../../../gell-namespace/tenant/action/delete');

const note = require('../../gell-metadata/modules/domain/note');

const TENANT_ID = 'TESTTENANT';
const APPLICATION_ID = 'TEST:ADMIN';

// NOTE: TENANT data is namespaced by the TENANT's id (the admin buses' types middleware uses the session's tenantId)
const NAMESPACE = TENANT_ID;
const application = { id: APPLICATION_ID };

describe('gell-namespace TENANT administration', function() {
    before(runtime.beforeAll);

    beforeEach(async function() {
        const types = new Types();
        types.register(tenant.TYPE, tenant.model);
        types.register(note.TYPE, note.model, 'TENANT');
        types.register(member.TYPE, member.model, 'APPLICATION');

        const queries = new Queries();
        queries.registerModule(sessionQueries);
        queries.registerModule(activityQueries);

        const store = new MockStore('type', 'id');
        Object.assign(store.namedQueries, queryWrapper.ut(queries.definitions()));

        this.deps.define('types', types);
        this.deps.define('store', store);
        this.deps.alias('store', 'sessionStore');
        this.store = store;

        this.tenant = tenant.materialize({ id: TENANT_ID, name: 'Test Tenant' });
        await store.save(this.tenant);

        // NOTE: a NOTE in another TENANT's namespace, which must not be deleted
        types.set('namespace', 'OTHERTENANT', 'TENANT');
        await store.save(types.instance(note.TYPE, { title: 'other note' }));

        types.set('namespace', NAMESPACE, 'TENANT');
        await store.save(types.instance(note.TYPE, { title: 'first note' }));
        await store.save(types.instance(note.TYPE, { title: 'second note' }));

        // NOTE: MEMBERs are APPLICATION-scoped children of the TENANT
        types.set('namespace', APPLICATION_ID, 'APPLICATION');
        for (const [userId, parentId] of [['a@test', TENANT_ID], ['b@test', 'OTHERTENANT']]) {
            await store.save(types.instance(member.TYPE, { userId, parentId, role: 'user' }));
        }
    })

    const memberType = `${APPLICATION_ID}::${member.TYPE}`;

    describe('gell.tenant.items', function() {
        it('returns items under the TENANT namespace', async function() {
            const { tenant$, items$, members$ } = await tenantItems.effect({ params: { id: this.tenant.get('id') }, context: { application }, deps: this.deps });

            assert.strictEqual(tenant$.id, this.tenant.get('id'));

            const titles = items$.filter(i$ => i$.type === `${NAMESPACE}::${note.TYPE}`).map(i$ => i$.title).sort();

            assert.deepStrictEqual(titles, ['first note', 'second note']);
            assert(items$.every(i$ => i$.type.startsWith(`${NAMESPACE}::`)));
            assert.deepStrictEqual(members$.map(m$ => m$.userId), ['a@test']);
        })

        it('fails for unknown TENANT', async function() {
            await assert.rejects(tenantItems.effect({ params: { id: 'NOSUCHTENANT' }, deps: this.deps }), /not found/);
        })
    })

    describe('gell.tenant.delete', function() {
        it('deletes namespace items and MEMBERs, then TENANT', async function() {
            const operations = [];
            const $txn = { next: operation => operations.push(operation) };

            const { tenant$, items$, members$ } = await deleteTenant.effect({ params: { id: this.tenant.get('id') }, context: { $txn, application }, deps: this.deps });

            const keys = operations.map(({ operation, command }) => {
                assert.strictEqual(operation, 'explicit');

                return command.Delete.Key;
            });

            assert.deepStrictEqual(keys, [...items$, ...members$, tenant$].map(({ type, id }) => ({ type, id })));
            assert.strictEqual(keys.filter(k => k.type === `${NAMESPACE}::${note.TYPE}`).length, 2);
            assert(!keys.some(k => k.type.startsWith('OTHERTENANT::')));
            assert.strictEqual(keys.filter(k => k.type === memberType).length, 1);
        })

        it('requires $txn', async function() {
            await assert.rejects(deleteTenant.effect({ params: { id: this.tenant.get('id') }, context: { application }, deps: this.deps }), /\$txn is required/);
        })
    })
})
