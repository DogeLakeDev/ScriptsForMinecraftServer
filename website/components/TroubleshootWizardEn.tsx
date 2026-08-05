import TroubleshootWizard from "./TroubleshootWizard";
import tree from "../data/troubleshoot-tree.en.json";

export default function TroubleshootWizardEn() {
  return <TroubleshootWizard tree={tree} />;
}
