const MongoAdapter = require("moleculer-db-adapter-mongo");
require("dotenv").config();

module.exports = function(collection) {
  return {
    mixins: [require("moleculer-db")],
    adapter: new MongoAdapter(process.env.MONGO_URI || "mongodb://localhost/moleculer-project-manager"),
    collection,
  };
};
