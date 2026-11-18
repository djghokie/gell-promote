exports.__metadata = {
    name: 'unittest.note.create',
    description: 'creates a NOTE',
    triggers: {
        action: {
            params: {
                title: 'string',
            },
            transaction: 'NEW'
        }
    }
}

exports.action = async function() {
    throw new Error('NYI');
}
