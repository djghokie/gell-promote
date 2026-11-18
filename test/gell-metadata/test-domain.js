const assert = require('assert');

const runtime = require('gell-runtime/mocha');

const bootstrap = require('./bootstrap');

const { Types } = require('../../gell-discover/domain/types');
const tenant = require('../../gell-namespace/domain/tenant');

const note = require('./modules/domain/note');
const typesSnapshot = require('../../gell-metadata/snapshot/types');
const typeSnapshot = require('../../gell-metadata/snapshot/type');
const itemsSnapshot = require('../../gell-metadata/snapshot/items');
const actionsSnapshot = require('../../gell-metadata/snapshot/actions');
const snapshotsSnapshot = require('../../gell-metadata/snapshot/snapshots');
const actionSnapshot = require('../../gell-metadata/snapshot/action');
const snapshotSnapshot = require('../../gell-metadata/snapshot/snapshot');
const queriesSnapshot = require('../../gell-metadata/snapshot/queries');
const querySnapshot = require('../../gell-metadata/snapshot/query');
const queryRunSnapshot = require('../../gell-metadata/snapshot/query-run');
const operationsSnapshot = require('../../gell-metadata/snapshot/operations');
const operationSnapshot = require('../../gell-metadata/snapshot/operation');
const jobsSnapshot = require('../../gell-metadata/snapshot/jobs');
const jobSnapshot = require('../../gell-metadata/snapshot/job');

describe('gell-metadata', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    describe('gell.domain.types', function() {
        it('returns registered domain TYPEs', async function() {
            const types$ = await typesSnapshot.api({ params: {}, deps: this.deps });

            const names = types$.map(type$ => type$.name);

            assert(names.includes(note.TYPE), `missing ${note.TYPE}`);
            assert(names.includes(tenant.TYPE), `missing ${tenant.TYPE}`);
        })

        it('returns the namespace each TYPE is registered with', async function() {
            const types_ = new Types();

            types_.register(note.TYPE, note.model, 'TENANT');
            types_.register(tenant.TYPE, tenant.model);

            const types$ = await typesSnapshot.api({ params: {}, deps: this.deps.branch({ types: types_ }) });

            assert.deepStrictEqual(types$.find(type$ => type$.name === note.TYPE).namespace, 'TENANT');
            assert.deepStrictEqual(types$.find(type$ => type$.name === tenant.TYPE).namespace, undefined);
        })

        it('excludes events and snapshots', async function() {
            const types$ = await typesSnapshot.api({ params: {}, deps: this.deps });

            const names = types$.map(type$ => type$.name);

            assert(!names.includes('unittest.note.create'));
            assert(!names.includes('unittest.notes.all'));
        })

        it('sorts by name', async function() {
            const types$ = await typesSnapshot.api({ params: {}, deps: this.deps });

            const names = types$.map(type$ => type$.name);

            assert.deepStrictEqual(names, [...names].sort());
        })
    })

    describe('gell.domain.type', function() {
        async function lookupType(name) {
            return typeSnapshot.api({ params: { name }, deps: this.deps });
        }

        it('returns TYPE by name', async function() {
            const type$ = await lookupType.call(this, note.TYPE);

            assert.strictEqual(type$.name, note.TYPE);
            assert.deepStrictEqual(type$.extends, ['Session']);
        })

        it('includes own attributes', async function() {
            const type$ = await lookupType.call(this, note.TYPE);

            const title$ = type$.attributes.find(a$ => a$.name === 'title');

            assert.deepStrictEqual(title$, { name: 'title', type: 'string', source: note.TYPE });
        })

        it('includes inherited attributes', async function() {
            const type$ = await lookupType.call(this, note.TYPE);

            const id$ = type$.attributes.find(a$ => a$.name === 'id');

            assert.strictEqual(id$.type, 'uuid');
            assert.strictEqual(id$.source, 'Session');
            assert.strictEqual(id$.computed, true);
        })

        it('own attributes override inherited ones', async function() {
            const type$ = await lookupType.call(this, note.TYPE);

            const types$ = type$.attributes.filter(a$ => a$.name === 'type');

            assert.strictEqual(types$.length, 1);
            assert.strictEqual(types$[0].source, note.TYPE);
            assert.strictEqual(types$[0].default, note.TYPE);
        })

        it('reports unknown TYPE as 404', async function() {
            await assert.rejects(lookupType.call(this, 'UNITTEST#MISSING'), { status: 404 });
        })

        it('keeps description and deprecated', async function() {
            const type$ = await lookupType.call(this, note.TYPE);

            const userName$ = type$.attributes.find(a$ => a$.name === 'userName');

            assert.strictEqual(userName$.deprecated, true);
            assert.strictEqual(userName$.description, 'deprecated in favor of user projection');
        })

        describe('describeModel', function() {
            const base = { name: 'TEST#BASE', attributes: { id: 'uuid' } };

            it('accepts a single (non-array) extends', function() {
                const model$ = typeSnapshot.describeModel({ name: 'TEST#CHILD', extends: base, attributes: {} });

                assert.deepStrictEqual(model$.extends, ['TEST#BASE']);
                assert.deepStrictEqual(model$.attributes, [{ name: 'id', type: 'uuid', source: 'TEST#BASE' }]);
            })

            it('accepts a function spec as computed', function() {
                const model$ = typeSnapshot.describeModel({ name: 'TEST#FN', attributes: { label: function() { return 'x'; } } });

                assert.deepStrictEqual(model$.attributes, [{ name: 'label', computed: true, source: 'TEST#FN' }]);
            })

            it('accepts a derive spec as computed', function() {
                const model$ = typeSnapshot.describeModel({ name: 'TEST#DERIVE', attributes: { label: { type: 'string', derive: () => 'x' } } });

                assert.deepStrictEqual(model$.attributes, [{ name: 'label', type: 'string', computed: true, source: 'TEST#DERIVE' }]);
            })

            it('accepts array attributes', function() {
                const model$ = typeSnapshot.describeModel({ name: 'TEST#ARRAY', attributes: ['label', { name: 'count', type: 'number' }] });

                assert.deepStrictEqual(model$.attributes, [
                    { name: 'label', source: 'TEST#ARRAY' },
                    { name: 'count', type: 'number', source: 'TEST#ARRAY' },
                ]);
            })
        })
    })

    describe('gell.domain.type.items', function() {
        async function saveNote(title) {

        }

        async function lookupItems(name, namespace) {
            return itemsSnapshot.api({ params: { name, namespace }, deps: this.deps });
        }

        it('returns items of TYPE', async function() {
            const types = this.deps.resolveSingle('types');

            // NOTE: NOTE is TENANT namespaced, so items are stored (and looked up) under types.name
            await this.store.save(types.instance(note.TYPE, { title: 'first' }));
            await this.store.save(types.instance(note.TYPE, { title: 'second' }));

            const items$ = await lookupItems.call(this, note.TYPE);

            assert.deepStrictEqual(items$.map(item$ => item$.title).sort(), ['first', 'second']);
            assert(items$.every(item$ => item$.type === types.name(note.TYPE)));
        })

        it('excludes items of other TYPEs', async function() {
            await this.store.save(note.materialize({ title: 'first' }));

            const items$ = await lookupItems.call(this, tenant.TYPE);

            assert.deepStrictEqual(items$.map(item$ => item$.id), [this.tenant.get('id')]);
        })

        it('returns items under a namespaced type', async function() {
            const namespaced_ = note.materialize({ title: 'namespaced' });
            namespaced_.set('type', `TEST::${note.TYPE}`);

            await this.store.save(namespaced_);
            await this.store.save(note.materialize({ title: 'plain' }));

            const items$ = await lookupItems.call(this, note.TYPE, 'TEST');

            assert.deepStrictEqual(items$.map(item$ => item$.title), ['namespaced']);
            assert.strictEqual(items$[0].type, `TEST::${note.TYPE}`);
        })

        it('returns no items for a TYPE without any', async function() {
            const items$ = await lookupItems.call(this, note.TYPE);

            assert.deepStrictEqual(items$, []);
        })

        it('reports unknown TYPE as 404', async function() {
            await assert.rejects(lookupItems.call(this, 'UNITTEST#MISSING'), { status: 404 });
        })
    })

    describe('gell.domain.actions', function() {
        it('returns registered actions with metadata', async function() {
            const actions$ = await actionsSnapshot.api({ params: {}, deps: this.deps });

            const create$ = actions$.find(action$ => action$.name === 'unittest.note.create');

            assert(create$, 'missing unittest.note.create');
            assert.strictEqual(create$.description, 'creates a NOTE');
            assert.deepStrictEqual(create$.triggers.action.params, { title: 'string' });
        })

        it('excludes types and snapshots', async function() {
            const actions$ = await actionsSnapshot.api({ params: {}, deps: this.deps });

            const names = actions$.map(action$ => action$.name);

            assert(!names.includes(note.TYPE));
            assert(!names.includes('unittest.notes.all'));
        })

        it('sorts by name', async function() {
            const actions$ = await actionsSnapshot.api({ params: {}, deps: this.deps });

            const names = actions$.map(action$ => action$.name);

            assert.deepStrictEqual(names, [...names].sort());
        })
    })

    describe('gell.domain.snapshots', function() {
        it('returns registered snapshots with metadata', async function() {
            const snapshots$ = await snapshotsSnapshot.api({ params: {}, deps: this.deps });

            const note$ = snapshots$.find(snapshot$ => snapshot$.name === 'unittest.note');

            assert(note$, 'missing unittest.note');
            assert.strictEqual(note$.description, 'returns a NOTE by id');
            assert.deepStrictEqual(note$.triggers.api.params, { id: 'uuid' });
        })

        it('excludes types and actions', async function() {
            const snapshots$ = await snapshotsSnapshot.api({ params: {}, deps: this.deps });

            const names = snapshots$.map(snapshot$ => snapshot$.name);

            assert(!names.includes(note.TYPE));
            assert(!names.includes('unittest.note.create'));
        })

        it('sorts by name', async function() {
            const snapshots$ = await snapshotsSnapshot.api({ params: {}, deps: this.deps });

            const names = snapshots$.map(snapshot$ => snapshot$.name);

            assert.deepStrictEqual(names, [...names].sort());
        })
    })

    describe('gell.domain.action', function() {
        async function lookupAction(name) {
            return actionSnapshot.api({ params: { name }, deps: this.deps });
        }

        it('returns action metadata by name', async function() {
            const action$ = await lookupAction.call(this, 'unittest.note.create');

            assert.strictEqual(action$.name, 'unittest.note.create');
            assert.strictEqual(action$.description, 'creates a NOTE');
            assert.deepStrictEqual(action$.triggers.action, { params: { title: 'string' }, transaction: 'NEW' });
        })

        it('reports a snapshot name as 404', async function() {
            await assert.rejects(lookupAction.call(this, 'unittest.notes.all'), { status: 404 });
        })

        it('reports unknown action as 404', async function() {
            await assert.rejects(lookupAction.call(this, 'unittest.note.missing'), { status: 404 });
        })
    })

    describe('gell.domain.snapshot', function() {
        async function lookupSnapshot(name) {
            return snapshotSnapshot.api({ params: { name }, deps: this.deps });
        }

        it('returns snapshot metadata by name', async function() {
            const snapshot$ = await lookupSnapshot.call(this, 'unittest.note');

            assert.strictEqual(snapshot$.name, 'unittest.note');
            assert.strictEqual(snapshot$.description, 'returns a NOTE by id');
            assert.deepStrictEqual(snapshot$.triggers.api, { params: { id: 'uuid' } });
        })

        it('reports an action name as 404', async function() {
            await assert.rejects(lookupSnapshot.call(this, 'unittest.note.create'), { status: 404 });
        })

        it('reports unknown snapshot as 404', async function() {
            await assert.rejects(lookupSnapshot.call(this, 'unittest.missing'), { status: 404 });
        })
    })

    describe('gell.domain.queries', function() {
        it('returns named queries registered with the store', async function() {
            const queries$ = await queriesSnapshot.api({ params: {}, deps: this.deps });

            const names = queries$.map(query$ => query$.name);

            assert(names.includes('sessions.activity.type'), 'missing sessions.activity.type');
            assert(names.includes('session.children'), 'missing session.children');

            names.forEach(name => assert(this.store.namedQueries[name], `query (name=${name}) not registered with the store`));
        })

        it('includes query metadata', async function() {
            const queries$ = await queriesSnapshot.api({ params: {}, deps: this.deps });

            const query$ = queries$.find(q$ => q$.name === 'session.children');

            assert.deepStrictEqual(query$, {
                name: 'session.children',
                description: 'retrieves all sessions with a specific type and parentId',
                parameters: [
                    { name: 'parentId', type: 'uuid', optional: false },
                    { name: 'type', type: 'string', optional: true },
                ],
            });
        })

        it('sorts by name', async function() {
            const queries$ = await queriesSnapshot.api({ params: {}, deps: this.deps });

            const names = queries$.map(query$ => query$.name);

            assert.deepStrictEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
        })
    })

    describe('gell.domain.query', function() {
        async function lookupQuery(name) {
            return querySnapshot.api({ params: { name }, deps: this.deps });
        }

        it('returns query metadata by name', async function() {
            const query$ = await lookupQuery.call(this, 'sessions.activity.type');

            assert.deepStrictEqual(query$, {
                name: 'sessions.activity.type',
                description: 'returns session activity, most recent first, by type',
                parameters: [
                    { name: 'type', type: 'string', optional: false },
                ],
            });
        })

        it('reports unknown query as 404', async function() {
            await assert.rejects(lookupQuery.call(this, 'unittest.missing'), { status: 404 });
        })
    })

    describe('gell.domain.query.run', function() {
        const administrator = { snapshotAttribute: name => name === 'role' ? 'administrator' : undefined };

        async function runQuery(params, caller=administrator) {
            return queryRunSnapshot.api({ caller, params, deps: this.deps });
        }

        beforeEach(async function() {
            await this.store.save(note.materialize({ title: 'first' }));
            await this.store.save(note.materialize({ title: 'second' }));
            await this.store.save(note.materialize({ title: 'third' }));
        })

        it('returns items matching the query args', async function() {
            const run$ = await runQuery.call(this, { name: 'sessions.activity.type', args: { type: note.TYPE } });

            assert.strictEqual(run$.name, 'sessions.activity.type');
            assert.deepStrictEqual(run$.args, { type: note.TYPE });
            assert.deepStrictEqual(run$.items.map(item$ => item$.title).sort(), ['first', 'second', 'third']);
            assert.strictEqual(run$.truncated, false);
        })

        it('caps items at limit and reports truncated', async function() {
            const run$ = await runQuery.call(this, { name: 'sessions.activity.type', args: { type: note.TYPE }, limit: 2 });

            assert.strictEqual(run$.items.length, 2);
            assert.strictEqual(run$.limit, 2);
            assert.strictEqual(run$.truncated, true);
        })

        it('is not truncated when items equal limit', async function() {
            const run$ = await runQuery.call(this, { name: 'sessions.activity.type', args: { type: note.TYPE }, limit: 3 });

            assert.strictEqual(run$.items.length, 3);
            assert.strictEqual(run$.truncated, false);
        })

        it('accepts args as a JSON string', async function() {
            const run$ = await runQuery.call(this, { name: 'sessions.activity.type', args: JSON.stringify({ type: note.TYPE }) });

            assert.strictEqual(run$.items.length, 3);
        })

        it('omits blank optional args', async function() {
            const run$ = await runQuery.call(this, { name: 'session.children', args: { parentId: this.tenant.get('id'), type: '' } });

            assert.deepStrictEqual(run$.args, { parentId: this.tenant.get('id') });
        })

        it('reports a missing required arg as 400', async function() {
            await assert.rejects(runQuery.call(this, { name: 'sessions.activity.type', args: { type: '' } }), { status: 400 });
        })

        it('reports unknown query as 404', async function() {
            await assert.rejects(runQuery.call(this, { name: 'unittest.missing' }), { status: 404 });
        })

        it('rejects a caller that is not an administrator as 403', async function() {
            const user = { snapshotAttribute: name => name === 'role' ? 'user' : undefined };

            await assert.rejects(runQuery.call(this, { name: 'sessions.activity.type', args: { type: note.TYPE } }, user), { status: 403 });
        })
    })

    describe('gell.domain.operations', function() {
        it('returns named operations registered with the store', async function() {
            const operations$ = await operationsSnapshot.api({ params: {}, deps: this.deps });

            const names = operations$.map(operation$ => operation$.name);

            assert(names.includes('session.touch'), 'missing session.touch');
            assert(names.includes('session.end'), 'missing session.end');

            names.forEach(name => assert(this.store.writeOptions.namedOperations[name], `operation (name=${name}) not registered with the store`));
        })

        it('includes operation metadata', async function() {
            const operations$ = await operationsSnapshot.api({ params: {}, deps: this.deps });

            const operation$ = operations$.find(o$ => o$.name === 'session.update');

            assert.deepStrictEqual(operation$, {
                name: 'session.update',
                description: 'updates a single session attribute',
                parameters: [
                    { name: 'attr', type: 'string', optional: false },
                    { name: 'val', type: 'any', optional: false },
                ],
            });
        })

        it('sorts by name', async function() {
            const operations$ = await operationsSnapshot.api({ params: {}, deps: this.deps });

            const names = operations$.map(operation$ => operation$.name);

            assert.deepStrictEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
        })
    })

    describe('gell.domain.operation', function() {
        async function lookupOperation(name) {
            return operationSnapshot.api({ params: { name }, deps: this.deps });
        }

        it('returns operation metadata by name', async function() {
            const operation$ = await lookupOperation.call(this, 'session.touch');

            assert.deepStrictEqual(operation$, {
                name: 'session.touch',
                description: 'updates updatedTs attribute',
                parameters: [
                    { name: 'ts', type: 'timestamp', optional: true },
                ],
            });
        })

        it('reports unknown operation as 404', async function() {
            await assert.rejects(lookupOperation.call(this, 'session.missing'), { status: 404 });
        })
    })

    describe('gell.domain.jobs', function() {
        it('returns registered jobs', async function() {
            const jobs$ = await jobsSnapshot.api({ params: {}, deps: this.deps });

            const report$ = jobs$.find(job$ => job$.name === 'unittest.report');

            assert(report$, 'missing unittest.report');
            assert.strictEqual(report$.description, 'reports fixture items');
        })

        it('returns only name and description', async function() {
            const jobs$ = await jobsSnapshot.api({ params: {}, deps: this.deps });

            jobs$.forEach(job$ => assert.deepStrictEqual(Object.keys(job$), ['name', 'description']));
        })

        it('sorts by name', async function() {
            const jobs$ = await jobsSnapshot.api({ params: {}, deps: this.deps });

            const names = jobs$.map(job$ => job$.name);

            assert.deepStrictEqual(names, [...names].sort());
        })
    })

    describe('gell.domain.job', function() {
        async function lookupJob(name) {
            return jobSnapshot.api({ params: { name }, deps: this.deps });
        }

        it('returns job by name', async function() {
            const job$ = await lookupJob.call(this, 'unittest.report');

            assert.deepStrictEqual(job$, {
                name: 'unittest.report',
                description: 'reports fixture items',
                dependencies: [],
                provides: [],
            });
        })

        it('reports unknown job as 404', async function() {
            await assert.rejects(lookupJob.call(this, 'unittest.missing'), { status: 404 });
        })
    })
})
