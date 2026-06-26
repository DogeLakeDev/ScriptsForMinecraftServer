import minecraftLinting from "eslint-plugin-minecraft-linting";
import tsParser from "@typescript-eslint/parser";
import ts from "@typescript-eslint/eslint-plugin";
export default [
  {
    files: ["scripts/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
    },
    plugins: {
      ts,
      "minecraft-linting": minecraftLinting,
    },
    /*- avoid-unnecessary-command — 
    如果在 API 中有对应方法（如 player.teleport() ），
    就禁止使用命令（如 /tp ）。
    */
    rules: {
      "minecraft-linting/avoid-unnecessary-command": "error",
    },
  },
];