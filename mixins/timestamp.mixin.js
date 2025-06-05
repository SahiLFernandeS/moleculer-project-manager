module.exports = {
    hooks: {
      before: {
        create: [
          async function addTimestamps(ctx) {
            ctx.params.createdAt = new Date();
            ctx.params.updatedAt = new Date();
          }
        ],
        update: [
          async function updateTimestamp(ctx) {
            ctx.params.updatedAt = new Date();
          }
        ]
      }
    }
};