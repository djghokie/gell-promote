const assert = require('assert');

const javascript = require('gell-domain/binding/javascript');

const { Stereotypes } = require('../../../gell-stereotype/domain/stereotypes');
const { resolveType } = require('../../../gell-stereotype/util/extension');

const namespace = require('../../../gell-namespace/stereotype/namespace');
const application = require('../../../gell-namespace/stereotype/application');

const THING_MODEL = { attributes: { name: { type: 'string' } } };
const THING = { name: 'thing', types: { 'UNITTEST#THING': { model: THING_MODEL } } };

describe('gell-stereotype/domain/extension', function() {
    describe('resolveType', function() {
        it('resolves a stereotype type as abstract', function() {
            assert.deepStrictEqual(resolveType(THING, 'UNITTEST#THING'),
                { name: 'UNITTEST#THING', model: THING_MODEL, abstract: true });
        })

        it('resolves a type extension to a model that extends the stereotype type', function() {
            const WIDGET = { name: 'WIDGET', extends: THING, types: { 'UNITTEST#THING': { name: 'UNITTEST#WIDGET' } } };

            const { name, model, abstract } = resolveType(WIDGET, 'UNITTEST#THING');

            assert.strictEqual(name, 'UNITTEST#WIDGET');
            assert.strictEqual(abstract, false);
            assert.deepStrictEqual(model.extends, [THING_MODEL]);
        })

        it('resolves stereotypes extended by name', function() {
            const stereotypes = new Stereotypes();
            stereotypes.register(THING);

            const GADGET = { name: 'GADGET', extends: 'thing', types: { 'UNITTEST#THING': { name: 'UNITTEST#GADGET' } } };

            assert.strictEqual(resolveType(GADGET, 'UNITTEST#THING', stereotypes).name, 'UNITTEST#GADGET');
        })

        it('resolves a type inherited through an extension', function() {
            const WIDGET = { name: 'WIDGET', extends: THING, types: { 'UNITTEST#THING': { name: 'UNITTEST#WIDGET' } } };
            const SPECIAL = { name: 'SPECIAL', extends: WIDGET };

            assert.strictEqual(resolveType(SPECIAL, 'UNITTEST#THING').name, 'UNITTEST#WIDGET');
        })

        it('extends the type of an extension it extends', function() {
            const WIDGET = { name: 'WIDGET', extends: THING, types: { 'UNITTEST#THING': { name: 'UNITTEST#WIDGET' } } };
            const SPECIAL = { name: 'SPECIAL', extends: WIDGET, types: { 'UNITTEST#THING': { name: 'UNITTEST#SPECIAL' } } };

            const widget = resolveType(WIDGET, 'UNITTEST#THING');
            const special = resolveType(SPECIAL, 'UNITTEST#THING');

            assert.strictEqual(special.name, 'UNITTEST#SPECIAL');
            assert.deepStrictEqual(special.model.extends, [widget.model]);
        })

        it('returns undefined for a type no stereotype declares', function() {
            assert.strictEqual(resolveType(THING, 'UNITTEST#OTHER'), undefined);
        })

        it('fails for a type extension of a type no stereotype declares', function() {
            const BROKEN = { name: 'BROKEN', extends: THING, types: { 'UNITTEST#OTHER': { name: 'UNITTEST#BROKEN' } } };

            assert.throws(() => resolveType(BROKEN, 'UNITTEST#OTHER'), /none of its stereotypes declare/);
        })
    })

    describe('APPLICATION', function() {
        it('extends GELL#NAMESPACE', function() {
            const { name, model } = resolveType(application, 'GELL#NAMESPACE');

            assert.strictEqual(name, 'NAMESPACE#APPLICATION');
            assert.strictEqual(model.extends[0], namespace.types['GELL#NAMESPACE'].model);
        })

        it('materializes an APPLICATION', function() {
            const { model } = resolveType(application, 'GELL#NAMESPACE');

            const application_ = javascript.materialize({ parentId: 'INCUBATOR', relativeId: 'WEB', name: 'Web' }, model);

            assert.deepStrictEqual(application_.snapshotPartial(['id', 'type', 'name']),
                { id: 'INCUBATOR:WEB', type: 'NAMESPACE#APPLICATION', name: 'Web' });
        })
    })
})
