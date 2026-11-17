import { RequirementGroup, DecisionRoute, PlantCode } from '@corvo/shared-types';

export interface OpenPOEntry {
  po_id: string;
  supplier_id: string;
  plant: PlantCode;
  route: DecisionRoute;
  first_created_at: string;
  group_ids: string[];
  total_value_inr: number;
}

export class POConsolidationEngine {
  private openPOs: OpenPOEntry[] = [];
  private poCounter: number = 1;
  private windowHours: number = 24;

  constructor(windowHours: number = 24) {
    this.windowHours = windowHours;
  }

  public reset(): void {
    this.openPOs = [];
    this.poCounter = 1;
  }

  public assignPO(
    groupId: string,
    supplierId: string,
    plant: PlantCode,
    route: DecisionRoute,
    firstCreatedAtStr: string,
    requirementValueInr: number
  ): string {
    const reqTime = new Date(firstCreatedAtStr).getTime();
    const maxDiffMs = this.windowHours * 60 * 60 * 1000;

    let targetPO: OpenPOEntry | null = null;

    // A requirement joins the earliest open PO it qualifies for (Section 7.2)
    for (const po of this.openPOs) {
      if (po.supplier_id === supplierId && po.plant === plant && po.route === route) {
        const poFirstTime = new Date(po.first_created_at).getTime();
        const diffMs = reqTime - poFirstTime;
        // Raised within windowHours of the first requirement on that PO
        if (diffMs >= 0 && diffMs <= maxDiffMs) {
          targetPO = po;
          break;
        }
      }
    }

    if (targetPO) {
      targetPO.group_ids.push(groupId);
      targetPO.total_value_inr += requirementValueInr;
      return targetPO.po_id;
    }

    // Otherwise it starts a new PO (Section 7.2)
    const newPoId = `PO-${String(this.poCounter++).padStart(4, '0')}`;
    this.openPOs.push({
      po_id: newPoId,
      supplier_id: supplierId,
      plant,
      route,
      first_created_at: firstCreatedAtStr,
      group_ids: [groupId],
      total_value_inr: requirementValueInr
    });

    return newPoId;
  }

  public getConsolidatedPOs(): OpenPOEntry[] {
    return this.openPOs;
  }
}
