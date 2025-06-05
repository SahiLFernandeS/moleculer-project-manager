const DbMixin = require("../mixins/db.mixin");

module.exports = {
    name: "users",
    mixins: [DbMixin("users")],
    /**
     * Settings
     */
    settings: {
        // Define any settings for the users service here
    },
    /**
     * Dependencies
     */
    dependencies: [],
    /**
     * Actions
     */
    actions: {
        me: {
            async handler(ctx) {
                const user = ctx.meta.user;
                if (!user) throw new Error("Unauthorized");
                const full = await this.adapter.findById(user._id);
                if (!full) throw new Error("User not found");
                return { id: full._id, name: full.name, email: full.email, role: full.role };
            }
        }
    },
    /**
     * Events
     */
    events: {
        
    },
}