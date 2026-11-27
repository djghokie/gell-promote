const queries = require('gell-session/dynamodb/queries');

/**
 * gell-session's named queries (gell-session/dynamodb/queries), with session.children and session.children.active
 * declaring parentId as a string
 *
 * WIP: gell-session declares parentId 'uuid', but a parent is not always a uuid: TENANT and APPLICATION ids are
 * namespace strings (e.g. INCUBATOR:BLUEHOUR), and gell-web users/members and gell-namespace TENANT items query their
 * children; now that gell-promote's store (gell-aws-dynamodb/named) checks parameter types, fix the declaration
 * in gell-session and register its queries directly again
 */
const PARENT_ID = ['session.children', 'session.children.active'];

module.exports = Object.fromEntries(Object.entries(queries).map(([name, def]) => {
    if (!PARENT_ID.includes(name)) return [name, def];

    return [name, { ...def, parameters: { ...def.parameters, parentId: 'string' } }];
}));
