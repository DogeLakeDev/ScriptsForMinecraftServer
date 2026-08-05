import TroubleshootWizard from "./TroubleshootWizard";
import tree from "../data/troubleshoot-tree.zh.json";

export default function TroubleshootWizardZh() {
  return <TroubleshootWizard tree={tree} />;
}
