import { system } from "@minecraft/server";
import { HttpRequestMethod } from "@minecraft/server-net";
import { debug } from "../../../../../scriptsforminecraftserver/scripts/libs/DebugLog.js";
import { HttpDB } from "../../../../../scriptsforminecraftserver/scripts/libs/HttpDB.js";

export class LandTax {
  private static intervalId: number | null = null;
  private static readonly CHECK_INTERVAL = 7200;

  static start(): void {
    debug.i("LAND", "LandTax.start");
    if (this.intervalId !== null) return;
    this.intervalId = system.runInterval(() => {
      this.collectAllTaxes();
    }, this.CHECK_INTERVAL);
  }

  static stop(): void {
    debug.i("LAND", "LandTax.stop");
    if (this.intervalId !== null) {
      system.clearRun(this.intervalId);
      this.intervalId = null;
    }
  }

  private static async collectAllTaxes(): Promise<void> {
    debug.i("LAND", "collectAllTaxes: starting tax collection");
    const result = await HttpDB.typedRequest(HttpRequestMethod.GET, "/api/sfmc/lands");
    if (!result.ok) {
      debug.e("LAND", "collectAllTaxes: failed to fetch lands");
      return;
    }
    const lands = (result.data as any)?.lands || [];
    debug.i("LAND", `collectAllTaxes: processing ${lands.length} lands`);
    for (const land of lands) {
      if (land.tax_rate <= 0) continue;
      if (land.tax_due_at && land.tax_due_at > Date.now()) continue;
      const taxResult = await HttpDB.typedRequest(
        HttpRequestMethod.POST,
        `/api/sfmc/lands/${encodeURIComponent(land.id)}/tax-collect`,
        {
          actorId: "system",
        }
      );
      if (!taxResult.ok && (taxResult.data as any)?.frozen) {
        debug.w("LAND", `collectAllTaxes: land ${land.name || land.id} frozen due to tax debt`);
      }
    }
  }
}
