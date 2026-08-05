// craco.config.js
const path = require("path");
require("dotenv").config();

const webpackConfig = {
  eslint: {
    configure: {
      // "prettier" (eslint-config-prettier) must stay LAST so it turns off
      // any formatting rules that would conflict with Prettier.
      extends: ["plugin:react-hooks/recommended", "prettier"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    configure: (webpackConfig) => {
      // Add ignored patterns to reduce watched directories
      webpackConfig.watchOptions = {
        ...webpackConfig.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/build/**",
          "**/dist/**",
          "**/coverage/**",
          "**/public/**",
        ],
      };

      return webpackConfig;
    },
  },
};

module.exports = webpackConfig;
