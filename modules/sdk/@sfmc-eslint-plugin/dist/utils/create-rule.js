import { ESLintUtils } from "@typescript-eslint/utils";
export const createRule = ESLintUtils.RuleCreator((name) => `https://github.com/DogeLakeDev/ScriptsForMinecraftServer/blob/main/modules/sdk/@sfmc-eslint-plugin/README.md#${name}`);
