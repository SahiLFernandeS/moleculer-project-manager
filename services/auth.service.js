const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const DbMixin = require("../mixins/db.mixin");


const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

module.exports = {
    name: "auth",
    mixins: [DbMixin("users"), require("../mixins/timestamp.mixin")],
    /**
     * Settings
     */
    settings: {
        // Define any settings for the auth service here
        fields: [
            "_id",
            "email",
            "password",
            "name",
            "role",
            "createdAt",
            "updatedAt",
            "deletedAt"
        ],

        entityValidator: {
            email: "email",
            password: "string|min:6",
            name: "string|min:2|max:50",
            role: { type: "enum", values: ["admin", "manager", "member"], optional: true, default: "member" }
        }
    },
    hooks: {
        before: {
            create: [
                async function hashPassword(ctx) {
                    if (ctx.params.password) {
                        ctx.params.password = await bcrypt.hash(ctx.params.password, 10);
                    }
                }
            ]
        }
    },
    /**
     * Dependencies
     */
    dependencies: [],
    /**
     * Actions
     */
    actions: {
        register:{
            params: {
                email: "email",
                password: "string",
                name: "string",
                role: { type: "string", optional: true }
            },
            async handler(ctx) {
                const { email, password, name, role = "member" } = ctx.params;
                const existing = await this.adapter.findOne({ email });
                if (existing) throw new Error("Email already exists");

                const user = await this.actions.create(ctx.params, { parentCtx: ctx });
                return { id: user._id, email: user.email, name: user.name, role: user.role };
            }
        },

        login:{
            params: {
                email: "email",
                password: "string"
            },
            async handler(ctx) {
                const { email, password } = ctx.params;
                const user = await this.adapter.findOne({ email });
                if (!user || !(await bcrypt.compare(password, user.password))) {
                    throw new Error("Invalid credentials");
                }
                const token = jwt.sign(
                    { _id: user._id, email: user.email, role: user.role },
                    JWT_SECRET,
                    { expiresIn: "1d" }
                );
                return { token, id: user._id, email: user.email, role: user.role, name: user.name };
            }
        },

        resolveToken:{
            params: {},
            async handler(ctx) {
                const auth = ctx.meta.authorization;
                if (!auth) throw new Error("Missing token");
                const token = auth.replace("Bearer ", "");
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    return decoded;
                } catch (err) {
                    throw new Error("Invalid token");
                }
            }
        }
    },

    /**
     * Events
     */
    events: {
        // Define any events for the auth service here
    }
}