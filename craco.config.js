const path = require("path");

module.exports = {
  paths: {
    appSrc: path.resolve(__dirname, "src"),
    appIndexJs: path.resolve(__dirname, "src/index.js"),
  },
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
};
