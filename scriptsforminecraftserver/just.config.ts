/*构建任务管线*/
import { argv, parallel, series, task, tscTask } from "just-scripts";
import {
  BundleTaskParameters,
  CopyTaskParameters,
  bundleTask,
  cleanTask,
  cleanCollateralTask,
  copyTask,
  coreLint,
  mcaddonTask,
  setupEnvironment,
  ZipTaskParameters,
  STANDARD_CLEAN_PATHS,
  DEFAULT_CLEAN_DIRECTORIES,
  getOrThrowFromProcess,
  watchTask,
} from "@minecraft/core-build-tasks";
import path from "path";
import fs from "fs";
setupEnvironment(path.resolve(__dirname, ".env"));
const projectName = getOrThrowFromProcess("PROJECT_NAME");
const deployPath = getOrThrowFromProcess("CUSTOM_DEPLOYMENT_PATH");

const bundleTaskOptions: BundleTaskParameters = {
  entryPoint: path.join(__dirname, "./scripts/main.ts"),
  external: ["@minecraft/server", "@minecraft/server-ui", "@minecraft/server-net"],
  outfile: path.resolve(__dirname, "./dist/scripts/main.js"),
  minifyWhitespace: false,
  sourcemap: true,
  outputSourcemapPath: path.resolve(__dirname, "./dist/debug"),
};
const copyTaskOptions: CopyTaskParameters = {
  copyToBehaviorPacks: [`./behavior_packs/${projectName}`],
  copyToScripts: ["./dist/scripts"],
  copyToResourcePacks: [`./resource_packs/${projectName}`],
};
const mcaddonTaskOptions: ZipTaskParameters = {
  ...copyTaskOptions,
  outputFile: `./dist/packages/${projectName}.mcaddon`,
};

task("deploy-production", () => {
  const dev = path.join(deployPath, "development_behavior_packs", projectName);
  const prod = path.join(deployPath, "behavior_packs", projectName);
  if (!fs.existsSync(dev)) {
    console.warn(`[deploy] 源目录不存在: ${dev}`);
    return;
  }
  // 同步到 production
  fs.cpSync(dev, prod, { recursive: true, force: true });
  console.log(`[deploy] 已同步到 ${prod}`);
  // 删除 development 副本，避免 BDS 优先加载它
  fs.rmSync(dev, { recursive: true, force: true });
  console.log(`[deploy] 已删除 development 副本: ${dev}`);
});

task("lint", coreLint(["scripts/**/*.ts"], argv().fix));
task("typescript", tscTask());
task("bundle", bundleTask(bundleTaskOptions));
task("build", series("typescript", "bundle"));
task("clean-local", cleanTask(DEFAULT_CLEAN_DIRECTORIES));
task("clean-collateral", cleanCollateralTask(STANDARD_CLEAN_PATHS));
task("clean", parallel("clean-local", "clean-collateral"));
task("copyArtifacts", copyTask(copyTaskOptions));
task("package", series("clean-collateral", "copyArtifacts", "deploy-production"));
task(
  "local-deploy",
  watchTask(
    ["scripts/**/*.ts", "behavior_packs/**/*.{json,lang,tga,ogg,png}", "resource_packs/**/*.{json,lang,tga,ogg,png}"],
    series("clean-local", "build", "package")
  )
);
task("createMcaddonFile", mcaddonTask(mcaddonTaskOptions));
task("mcaddon", series("clean-local", "build", "createMcaddonFile"));
