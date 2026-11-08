/**
 * Copies the defined (not undefined) values of o
 *
 * NOTE: the session is passed as Next.js page props (gell-auth/page.js), which can't serialize undefined values
 */
function defined(o) {
    return Object.fromEntries(Object.entries(o).filter(([k, v]) => v !== undefined));
}

/**
 * Creates a new NextAuth session callback
 *
 * @returns session callback
 */
module.exports = function() {
    /**
     * Builds the session from the JWT token
     *
     * NOTE: this callback defines the session's shape, for both consumers
     *  - the client (useSession, getServerSession in page props)
     *  - the BROWSER caller: gell-auth/middleware/session materializes this session as is
     * so it builds a new object with only these fields, rather than adding to NextAuth's default session; don't add
     * a field the BROWSER models for another purpose (id, type, status, parentId)
     *
     * SESSION:
     *  - userId: the USER's userId (email); the gell-session Session identity
     *  - tenantId: TENANT selected after sign in (jwt callback); absent until selected
     *  - role: the USER's role in the TENANT (its MEMBER); absent until a TENANT is selected
     *  - user: NextAuth's default user (name, email, image) plus id (token sub), firstName, lastName, role
     *  - expires: from NextAuth
     *
     * WIP: this is subject to change and hasn't been fully thought out yet
     *  - role is probably needed to authorize API calls
     *  - user.id is probably easiest way to link session to user item
     *
     * ARGUMENTS:
     *  - session: NextAuth's default session ({ user: { name, email, image }, expires }), from the decoded JWT
     *  - token represents the JWT (after the jwt callback)
     *  - user: only provided with the database session strategy (undefined with JWT)
     *
     * @returns session
     */
    return ({ session, user, token }) => {
        if (!token) return session;

        const { user: user$={}, expires } = session;
        const { sub, firstName, lastName, role, tenantId } = token;
        const email = token.email || user$.email;

        return defined({
            userId: email,
            tenantId,
            role,
            user: defined({
                ...user$,
                id: sub,
                email,
                firstName,
                lastName,
                role,
            }),
            expires,
        });
    }

}
