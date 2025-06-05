const { ObjectId } = require("mongodb");

module.exports = {
    name: "projects",
    mixins: [require("../mixins/db.mixin")("projects"), require("../mixins/timestamp.mixin")],
    settings: {
        fields: ["_id", "name", "description", "ownerId", "createdAt", "updatedAt"],
        entityValidator: {
            name: { type: "string", min: 3 },
            description: { type: "string", optional: true }
        }
    },
    hooks: {
        before: {
            create: [
                function setOwner(ctx) {
                    ctx.params.ownerId = ctx.meta.user._id;
                    // ctx.params.createdAt = new Date();
                    // ctx.params.updatedAt = new Date();
                }
            ]
        }
    },
    actions: {
        create: {
            rest: "POST /",
            async handler(ctx) {
                const entity = await this.validateEntity(ctx.params); // run schema validation
                const created = await this.adapter.insert(entity); // insert directly using adapter
                return this.transformDocuments(ctx, {}, created); // apply field filtering & mapping
            }
        },
        list: {
            rest: "GET /",
            async handler(ctx) {
                const user = ctx.meta.user;
                let query = {};

                if (user.role === "admin") {
                    // Admin sees all
                    query = {};
                } else {
                    // Member/Manager sees their own projects
                    query = { ownerId: user._id };
                }
                return this.adapter.find({ query });
            }
        },
        get: {
            rest: "GET /:id",
            async handler(ctx) {
                const id = ctx.params.id;
                const user = ctx.meta.user;

                const project = await this.adapter.findOne({ _id: new ObjectId(id) });
                if (!project) throw new Error("Project not found");

                if (!this.canAccess(project, user)) {
                    throw new Error("Access denied");
                }

                return project;
            }
        },
        update: {
            rest: "PUT /:id",
            params: {
                name: { type: "string", min: 3, optional: true },
                description: { type: "string", optional: true }
            },
            async handler(ctx) {
                const id = ctx.params.id;
                const updates = ctx.params;
                const user = ctx.meta.user;
        
                const project = await this.adapter.findOne({ _id: new ObjectId(id) });
                if (!project) throw new Error("Project not found");
        
                if (!this.canAccess(project, user)) {
                  throw new Error("Access denied");
                }
        
                updates.updatedAt = new Date();
        
                await this.adapter.updateById(id, { $set: updates });
                return this.adapter.findById(id);
            }
        },
        remove: {
            rest: "DELETE /:id",
            async handler(ctx) {
                const id = ctx.params.id;
                const user = ctx.meta.user;

                const project = await this.adapter.findOne({ _id: new ObjectId(id) });
                if (!project) throw new Error("Project not found");

                if (!this.canAccess(project, user)) {
                    throw new Error("Access denied");
                }

                await this.adapter.removeById(id);
                return { ...project, deleted: true }; // return deleted project info
            }
        }
    },
    methods: {
        canAccess(project, user) {
          if (user.role === "admin") return true;
          return project.ownerId === user._id;
        }
    }
}