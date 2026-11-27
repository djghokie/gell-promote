const assert = require('assert');

const runtime = require('gell-runtime/mocha');

const bootstrap = require('./bootstrap');

const { Types } = require('../../gell-discover/domain/types');
const tenant = require('../../gell-namespace/domain/tenant');

const note = require('./modules/domain/note');
const typesSnapshot = require('../../gell-metadata/domain/type/snapshot/types');
const typeSnapshot = require('../../gell-metadata/domain/type/snapshot/type');
const itemsSnapshot = require('../../gell-metadata/domain/type/snapshot/items');
const attributesSnapshot = require('../../gell-metadata/dispatch/rule/snapshot/attributes');
const attributeSnapshot = require('../../gell-metadata/dispatch/rule/snapshot/attribute');
const attributeValidateSnapshot = require('../../gell-metadata/dispatch/rule/snapshot/validate');
const actionsSnapshot = require('../../gell-metadata/dispatch/action/snapshot/actions');
const snapshotsSnapshot = require('../../gell-metadata/dispatch/snapshot/snapshot/snapshots');
const actionSnapshot = require('../../gell-metadata/dispatch/action/snapshot/action');
const snapshotSnapshot = require('../../gell-metadata/dispatch/snapshot/snapshot/snapshot');
const queriesSnapshot = require('../../gell-aws-dynamodb/snapshot/queries');
const queryRunSnapshot = require('../../gell-aws-dynamodb/action/run');
const operationsSnapshot = require('../../gell-aws-dynamodb/snapshot/operations');
const jobsSnapshot = require('../../gell-metadata/job/snapshot/jobs');
const jobSnapshot = require('../../gell-metadata/job/snapshot/job');

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
            assert.deepStrictEqual(create$.triggers.action.params, { title: { name: 'title', type: 'string' } });
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

    describe('gell.domain.attributes', function() {
        it('returns the param types, sorted by name', async function() {
            const attributes$ = await attributesSnapshot.api({ params: {}, deps: this.deps });

            assert.deepStrictEqual(attributes$.map(type$ => type$.name), ['any', 'array', 'boolean', 'integer', 'number', 'object', 'state', 'string', 'timestamp', 'uuid']);
        })

        it('describes a type and its rules as data', async function() {
            const attributes$ = await attributesSnapshot.api({ params: {}, deps: this.deps });
            const string$ = attributes$.find(type$ => type$.name === 'string');

            assert.deepStrictEqual(string$, JSON.parse(JSON.stringify(string$)));
            assert.strictEqual(string$.allowBlank, false);
            assert.strictEqual(string$.coerce, false);
            assert.deepStrictEqual(string$.default, ['isString']);
            assert.deepStrictEqual(string$.rules.find(rule$ => rule$.name === 'isString'), { name: 'isString', default: true, definedBy: 'string' });
            assert.deepStrictEqual(string$.rules.find(rule$ => rule$.name === 'minLength'), { name: 'minLength', type: 'number', default: false, definedBy: 'string' });
        })

        it('names the type each inherited rule is defined by', async function() {
            const attributes$ = await attributesSnapshot.api({ params: {}, deps: this.deps });
            const integer$ = attributes$.find(type$ => type$.name === 'integer');
            const rule = name => integer$.rules.find(rule$ => rule$.name === name);

            assert.strictEqual(integer$.extends, 'number');
            assert.strictEqual(integer$.allowBlank, true);
            assert.strictEqual(integer$.coerce, true);
            assert.deepStrictEqual(integer$.default, ['isNumber', 'isInteger']);
            assert.strictEqual(rule('isNumber').definedBy, 'number');
            assert.strictEqual(rule('min').definedBy, 'number');
            assert.strictEqual(rule('isInteger').definedBy, 'integer');
            assert.strictEqual(rule('positive').definedBy, 'integer');
        })
    })

    describe('gell.domain.attribute', function() {
        async function lookupAttribute(name) {
            return attributeSnapshot.api({ params: { name }, deps: this.deps });
        }

        it('returns a param type and its rules by name', async function() {
            const integer$ = await lookupAttribute.call(this, 'integer');

            assert.strictEqual(integer$.name, 'integer');
            assert.strictEqual(integer$.extends, 'number');
            assert.deepStrictEqual(integer$.rules.find(rule$ => rule$.name === 'min'), { name: 'min', type: 'number', default: false, definedBy: 'number' });
            assert.deepStrictEqual(integer$.rules.find(rule$ => rule$.name === 'isInteger'), { name: 'isInteger', default: true, definedBy: 'integer' });
        })

        it('reports an unknown param type as 404', async function() {
            await assert.rejects(lookupAttribute.call(this, 'email'), { status: 404 });
            await assert.rejects(lookupAttribute.call(this, 'constructor'), { status: 404 });
        })
    })

    describe('gell.domain.attribute.validate', function() {
        async function validateValue(params) {
            return attributeValidateSnapshot.api({ params, deps: this.deps });
        }

        it('passes a valid value and returns it coerced', async function() {
            assert.deepStrictEqual(await validateValue.call(this, { name: 'integer', value: '4', rules: { positive: true, max: 12 } }), { valid: true, value: 4 });
        })

        it('reports the first rule a value fails', async function() {
            assert.deepStrictEqual(await validateValue.call(this, { name: 'integer', value: 13, rules: { positive: true, max: 12 } }), { valid: false, rule: 'max', message: 'must be at most 12' });
            assert.deepStrictEqual(await validateValue.call(this, { name: 'integer', value: 1.5 }), { valid: false, rule: 'isInteger', message: 'must be an integer' });
        })

        it('uses messages to override a message', async function() {
            const result$ = await validateValue.call(this, { name: 'string', value: 'ab', rules: { minLength: 3, messages: { minLength: 'too short' } } });

            assert.deepStrictEqual(result$, { valid: false, rule: 'minLength', message: 'too short' });
        })

        it('takes rules as a JSON string', async function() {
            assert.deepStrictEqual(await validateValue.call(this, { name: 'number', value: '7', rules: '{"min":10}' }), { valid: false, rule: 'min', message: 'must be at least 10' });
        })

        it('reports a mistake in the rules', async function() {
            const undefinedRule$ = await validateValue.call(this, { name: 'number', value: 1, rules: { minLength: 1 } });
            const badArgument$ = await validateValue.call(this, { name: 'number', value: 1, rules: { max: 'lots' } });

            assert.strictEqual(undefinedRule$.mistake, true);
            assert.match(undefinedRule$.message, /no rule defined \(type=number; rule=minLength\)/);
            assert.strictEqual(badArgument$.mistake, true);
            assert.match(badArgument$.message, /rule argument is not a valid number/);
        })

        it('reports an unknown param type as 404', async function() {
            await assert.rejects(validateValue.call(this, { name: 'email', value: 'x' }), { status: 404 });
        })
    })

    describe('gell.domain.snapshots', function() {
        it('returns registered snapshots with metadata', async function() {
            const snapshots$ = await snapshotsSnapshot.api({ params: {}, deps: this.deps });

            const note$ = snapshots$.find(snapshot$ => snapshot$.name === 'unittest.note');

            assert(note$, 'missing unittest.note');
            assert.strictEqual(note$.description, 'returns a NOTE by id');
            assert.deepStrictEqual(note$.triggers.api.params, { id: { name: 'id', type: 'uuid' } });
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
            assert.deepStrictEqual(action$.triggers.action, { params: { title: { name: 'title', type: 'string' } }, transaction: 'NEW' });
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
            assert.deepStrictEqual(snapshot$.triggers.api, { params: { id: { name: 'id', type: 'uuid' } } });
        })

        it('reports an action name as 404', async function() {
            await assert.rejects(lookupSnapshot.call(this, 'unittest.note.create'), { status: 404 });
        })

        it('reports unknown snapshot as 404', async function() {
            await assert.rejects(lookupSnapshot.call(this, 'unittest.missing'), { status: 404 });
        })
    })

    describe('store.named.queries', function() {
        it('returns named queries registered with the store', async function() {
            const queries$ = await queriesSnapshot.api({ params: {}, deps: this.deps });

            const names = queries$.map(query$ => query$.name);

            assert(names.includes('sessions.activity.type'), 'missing sessions.activity.type');
            assert(names.includes('session.children'), 'missing session.children');

            names.forEach(name => assert(this.store.queries.get(name), `query (name=${name}) not registered with the store`));
        })

        it('includes query metadata', async function() {
            const queries$ = await queriesSnapshot.api({ params: {}, deps: this.deps });

            const query$ = queries$.find(q$ => q$.name === 'session.children');

            assert.deepStrictEqual(query$, {
                name: 'session.children',
                description: 'retrieves all sessions with a specific type and parentId',
                parameters: [
                    { name: 'parentId', type: 'string', optional: false },
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

    describe('store.query.run', function() {
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

    describe('store.named.operations', function() {
        it('returns named operations registered with the store', async function() {
            const operations$ = await operationsSnapshot.api({ params: {}, deps: this.deps });

            const names = operations$.map(operation$ => operation$.name);

            assert(names.includes('session.touch'), 'missing session.touch');
            assert(names.includes('session.end'), 'missing session.end');

            names.forEach(name => assert(this.store.operations.get(name), `operation (name=${name}) not registered with the store`));
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
