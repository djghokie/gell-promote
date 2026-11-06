const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const operationWrapper = require('gell-aws-dynamodb/operation-wrapper');
const sessionOperations = operationWrapper.ut(require('gell-session/dynamodb/operations'));

const bootstrap = require('../bootstrap');

const tenant = require('../../../gell-namespace/domain/tenant');
const application = require('../../../gell-namespace/domain/application');

const member = require('../../../gell-web/member/domain/member');
const create = require('../../../gell-web/member/event/create');
const update = require('../../../gell-web/member/event/update');
const lookup = require('../../../gell-web/member/snapshot/member');
const members = require('../../../gell-web/member/snapshot/members');
const memberships = require('../../../gell-web/member/snapshot/memberships');

const APPLICATION_ID = 'UNITTEST:ADMIN';
const MEMBER_TYPE = `${APPLICATION_ID}::WEB#MEMBER`;

describe('MEMBER', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    let store, types, bluehour, peaktravel;

    beforeEach(async function() {
        store = this.deps.resolveSingle('store');
        // NOTE: session.update (web.member.update) is a named operation; same as test/gell-session/util/test-event.js
        store.writeOptions.namedOperations = sessionOperations;

        types = this.deps.resolveSingle('types');
        types.set('APPLICATION', APPLICATION_ID);

        bluehour = tenant.materialize({ id: 'UNITTEST:BLUEHOUR', name: 'Blue Hour' });
        peaktravel = tenant.materialize({ id: 'UNITTEST:PEAKTRAVEL', name: 'Peak Travel' });

        await store.save(bluehour);
        await store.save(peaktravel);
    })

    beforeEach(function() {
        this.createMember = async function(userId='user@test.com', role='administrator', tenant_=bluehour) {
            const $txn = store.write();

            const member_ = await create.action({
                params: {
                    parentId: tenant_.get('id'),
                    userId,
                    role
                },
                context: { $txn },
                deps: this.deps
            });

            await $txn.return().value;

            return member_;
        }
    })

    describe('web.member.create', function() {
        describe('action', function() {
            it('returns MEMBER', async function() {
                const member_ = await this.createMember();

                assert(member_);
            })

            it('saves MEMBER namespaced by the APPLICATION', async function() {
                const member_ = await this.createMember();

                const [member$] = store.select({ id: member_.get('id') });

                assert.strictEqual(member$.type, MEMBER_TYPE);
                assert.strictEqual(member$.parentId, 'UNITTEST:BLUEHOUR');
                assert.strictEqual(member$.userId, 'user@test.com');
                assert.strictEqual(member$.role, 'administrator');
                assert(member$.activeTs);
            })

            it('ignores a type parameter', async function() {
                const $txn = store.write();

                const member_ = await create.action({
                    params: {
                        parentId: bluehour.get('id'),
                        userId: 'user@test.com',
                        role: 'administrator',
                        type: 'SOMETHING#ELSE'
                    },
                    context: { $txn },
                    deps: this.deps
                });

                await $txn.return().value;

                assert.strictEqual(member_.get('type'), MEMBER_TYPE);
            })

            it('same USER can be a MEMBER of multiple TENANTs', async function() {
                await this.createMember('user@test.com', 'administrator', bluehour);
                await this.createMember('user@test.com', 'user', peaktravel);

                const members$ = store.select({ type: MEMBER_TYPE, userId: 'user@test.com' });

                assert.strictEqual(members$.length, 2);
            })

            it('fails if MEMBER already exists', async function() {
                await this.createMember();

                await assert.rejects(z => this.createMember(), /member already exists/);
            })

            it('fails if TENANT does not exist', async function() {
                const missing_ = tenant.materialize({ id: 'UNITTEST:MISSING' });

                await assert.rejects(z => this.createMember('user@test.com', 'administrator', missing_));
            })

            it('requires role', async function() {
                await assert.rejects(z => this.createMember('user@test.com', ''), /role is required/);
            })
        })

        describe('effect', function() {
            beforeEach(function() {
                this.createMemberEffect = async function(context={}) {
                    const $txn = store.write();

                    const member_ = await create.effect({
                        params: {
                            userId: 'user@test.com',
                            role: 'administrator'
                        },
                        context: Object.assign({ parent_: bluehour, $txn }, context),
                        deps: this.deps
                    });

                    await $txn.return().value;

                    return member_;
                }
            })

            it('saves MEMBER under the TENANT', async function() {
                const member_ = await this.createMemberEffect();

                const [member$] = store.select({ id: member_.get('id') });

                assert.strictEqual(member$.type, MEMBER_TYPE);
                assert.strictEqual(member$.parentId, 'UNITTEST:BLUEHOUR');
            })

            it('namespaceId overrides the registered namespace', async function() {
                const member_ = await this.createMemberEffect({ namespaceId: 'UNITTEST:OTHER' });

                assert.strictEqual(member_.get('type'), 'UNITTEST:OTHER::WEB#MEMBER');
            })
        })
    })

    describe('web.member.update', function() {
        it('updates role', async function() {
            const member_ = await this.createMember();

            const $txn = store.write();

            await update.action({
                params: {
                    id: member_.get('id'),
                    attribute: 'role',
                    value: 'user'
                },
                context: { $txn },
                deps: this.deps
            });

            await $txn.return().value;

            const [member$] = store.select({ id: member_.get('id') });

            assert.strictEqual(member$.role, 'user');
        })
    })

    describe('web.member.lookup', function() {
        beforeEach(async function() {
            await this.createMember('user@test.com', 'administrator', bluehour);
        })

        it('returns MEMBER for TENANT and USER', async function() {
            const member_ = await lookup.effect({
                params: { tenantId: 'UNITTEST:BLUEHOUR', userId: 'user@test.com' },
                deps: this.deps
            });

            assert.strictEqual(member_.snapshotAttribute('role'), 'administrator');
        })

        it('returns nothing for a TENANT the USER is not a MEMBER of', async function() {
            const member_ = await lookup.effect({
                params: { tenantId: 'UNITTEST:PEAKTRAVEL', userId: 'user@test.com' },
                deps: this.deps
            });

            assert.strictEqual(member_, undefined);
        })

        it('application (context) namespaces the lookup', async function() {
            // NOTE: sign in has no namespaced types registry
            types.set('APPLICATION', undefined);

            const member_ = await lookup.effect({
                params: { tenantId: 'UNITTEST:BLUEHOUR', userId: 'user@test.com' },
                context: { application: application.materialize({ id: APPLICATION_ID }).snapshot() },
                deps: this.deps
            });

            assert(member_);
            assert.strictEqual(member_.get('type'), MEMBER_TYPE);
        })
    })

    describe('web.members', function() {
        it('returns MEMBERs of a TENANT', async function() {
            await this.createMember('one@test.com', 'administrator', bluehour);
            await this.createMember('two@test.com', 'user', bluehour);
            await this.createMember('three@test.com', 'user', peaktravel);

            const members$ = await members.effect({ params: { tenantId: 'UNITTEST:BLUEHOUR' }, deps: this.deps });

            assert.deepStrictEqual(_.map(members$, 'userId').sort(), ['one@test.com', 'two@test.com']);
        })
    })

    describe('web.memberships', function() {
        it('returns a USER\'s MEMBERs across TENANTs', async function() {
            await this.createMember('user@test.com', 'administrator', bluehour);
            await this.createMember('user@test.com', 'user', peaktravel);
            await this.createMember('other@test.com', 'user', peaktravel);

            const members$ = await memberships.effect({ params: { userId: 'user@test.com' }, deps: this.deps });

            assert.deepStrictEqual(_.map(members$, 'parentId').sort(), ['UNITTEST:BLUEHOUR', 'UNITTEST:PEAKTRAVEL']);
        })
    })
})
