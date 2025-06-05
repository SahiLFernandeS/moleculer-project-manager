const { ObjectId } = require("mongodb");

module.exports = {
    name: "tasks",
    mixins: [require("../mixins/db.mixin")("tasks"), require("../mixins/timestamp.mixin")],
    
    /**
     * Settings
     */
    settings: {
        // Define any settings for the tasks service here
        fields: [
            "_id",
            "title",
            "description",
            "status",
            "priority",
            "projectId",
            "assigneeId",
            "dueDate",
            "createdAt",
            "updatedAt"
        ],
      
        entityValidator: {
            title: { type: "string", min: 3 },
            description: { type: "string", optional: true },
            status: { type: "enum", values: ["todo", "in-progress", "done"], default: "todo" },
            priority: { type: "enum", values: ["low", "medium", "high"], default: "medium" },
            projectId: {
                type: "custom",
                check(value) {
                  if (!ObjectId.isValid(value)) throw new Error("Invalid projectId");
                  return true;
                }
              },
            assigneeId: {
                type: "custom",
                optional: true,
                check(value) {
                  if (value && !ObjectId.isValid(value)) throw new Error("Invalid assigneeId");
                  return true;
                }
            },
            dueDate: { type: "date", optional: true }
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
        // Define actions for the tasks service here
        create: {
            rest: "POST /",
            async handler(ctx) {
                const entity = await this.validateEntity(ctx.params);
                const created = await this.adapter.insert(entity);
                if (!created) throw new Error("Task creation failed");
                return this.transformDocuments(ctx, {}, created);
            }
        },
        list: {
            rest: "GET /",
            async handler(ctx) {
                const user = ctx.meta.user;
                let query = {};

                if (user.role === "admin") {
                    // Admin sees all tasks
                    query = {};
                } else {
                    // Member/Manager sees tasks assigned to them or in their projects
                    query = {
                        // $or: [
                            // { assigneeId: user._id },
                            // { projectId: { $in: user.projects || [] } }
                        // ]
                    };
                }
                return this.adapter.find({ query });
            }
        },
        get: {
            rest: "GET /:id",
            async handler(ctx) {
                const id = ctx.params.id;
                const user = ctx.meta.user;

                const task = await this.adapter.findOne({ _id: new ObjectId(id) });
                if (!task) throw new Error("Task not found");

                if (!this.canAccess(task, user)) {
                    throw new Error("Access denied");
                }

                return task;
            }
        },
        update: {
            rest: "PUT /:id",
            params: {
                title: { type: "string", min: 3, optional: true },
                description: { type: "string", optional: true },
                status: { type: "enum", values: ["todo", "in-progress", "done"], optional: true },
                priority: { type: "enum", values: ["low", "medium", "high"], optional: true },
                assigneeId: {
                    type: "custom",
                    optional: true,
                    check(value) {
                        if (value && !ObjectId.isValid(value)) throw new Error("Invalid assigneeId");
                        return true;
                    }
                },
                dueDate: { type: "date", optional: true }
            },
            async handler(ctx) {
                const id = ctx.params.id;
                const updates = ctx.params;
                const user = ctx.meta.user;
                delete updates.id; // Remove id if present

                const task = await this.adapter.findOne({ _id: new ObjectId(id) });
                if (!task) throw new Error("Task not found");

                if (!this.canAccess(task, user)) {
                    throw new Error("Access denied");
                }

                const updated = await this.adapter.updateById(id, { $set: updates });
                return this.transformDocuments(ctx, {}, updated);
            }
        },
        remove: {
            rest: "DELETE /:id",
            async handler(ctx) {
                const id = ctx.params.id;
                const user = ctx.meta.user;

                const task = await this.adapter.findOne({ _id: new ObjectId(id) });
                if (!task) throw new Error("Task not found");

                if (!this.canAccess(task, user)) {
                    throw new Error("Access denied");
                }

                await this.adapter.removeById(id);
                return { ...task, deleted: true }; // return deleted task info
            }
        }
    },
    hooks: {
        before: {
            create: [
                function toObjectId(ctx) {
                    ctx.params.projectId = new ObjectId(ctx.params.projectId);
                    if (ctx.params.assigneeId) {
                      ctx.params.assigneeId = new ObjectId(ctx.params.assigneeId);
                    }
                },
                async function verifyProjectAccess(ctx) {
                  const projectId = ctx.params.projectId;
                //   const user = ctx.meta.user;
        
                  // Check if project exists
                  const project = await ctx.call("projects.get", { id: projectId.toString() }, { meta: ctx.meta });
        
                  if (!project) throw new Error("Invalid project ID");                
                }
            ]
        }
    },
    /**
     * Events
     */
    events: {
        // Define events for the tasks service here
    },
    /**
     * Methods
     */
    methods: {
        // Define any helper methods for the tasks service here
        async canAccess(task, user) {
            if (user.role === "admin") return true; // Admin can access all tasks

            // Check if the user is the assignee or if the task belongs to a project they can access
            if (task.assigneeId && task.assigneeId.toString() === user._id.toString()) {
                return true; // User is the assignee
            }
            const project = await this.broker.call("projects.get", { id: task.projectId.toString() }, { meta: { user } });
            if (project && (project.ownerId.toString() === user._id.toString() || user.projects.includes(project._id.toString()))) {
                return true; // User is the owner or has access to the project
            }
            return false; // Access denied
        }
    },
}