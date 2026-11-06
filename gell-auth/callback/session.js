/**
 * Creates a new NextAuth session callback
 * 
 * @returns session callback
 */
export default function() {
    /**
     * Populates session by exposing values from JWT token
     * 
     * WIP: this is subject to change and hasn't been fully thought out yet
     *  - role is probably needed to authorize API calls
     *  - user.id is probably easiest way to link session to user item
     * 
     * ARGUMENTS:
     *  - token represents the JWT
     * 
     * @returns populated session
     */
    return ({ session, user, token }) => {
        // console.debug('##### session', session, user, token);

        if (token) {
            const { sub, firstName, lastName, email, role } = token;

            if (sub) session.user.id = sub;
            if (firstName) session.user.firstName = firstName;
            if (lastName) session.user.lastName = lastName;
            if (email) session.user.email = email;
            if (role) {
                session.user.role = role;
                session.role = role;
            }
        }

        return session;
    }

}