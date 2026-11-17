import { describe, it, expect } from 'vitest';
import { POConsolidationEngine } from '../../apps/api/src/engines/po-consolidation';

describe('PO Consolidation Engine (Policy Section 7)', () => {
  it('consolidates requirements with same supplier, plant, route within 24 hours (Worked Example 14)', () => {
    const engine = new POConsolidationEngine(24);

    const po1 = engine.assignPO(
      'REQ-0001',
      'S007',
      'PUN1',
      'CONTRACT_PO',
      '2026-11-02 14:05',
      32547
    );

    const po2 = engine.assignPO(
      'REQ-0002',
      'S007',
      'PUN1',
      'CONTRACT_PO',
      '2026-11-03 10:30', // 20 hours 25 mins later <= 24 hours
      23227
    );

    expect(po1).toBe('PO-0001');
    expect(po2).toBe('PO-0001'); // Shared PO ID!
    expect(engine.getConsolidatedPOs().length).toBe(1);
    expect(engine.getConsolidatedPOs()[0].group_ids).toEqual(['REQ-0001', 'REQ-0002']);
  });

  it('does NOT consolidate requirements raised > 24 hours apart', () => {
    const engine = new POConsolidationEngine(24);

    const po1 = engine.assignPO(
      'REQ-0001',
      'S007',
      'PUN1',
      'CONTRACT_PO',
      '2026-11-02 10:00',
      10000
    );

    const po2 = engine.assignPO(
      'REQ-0002',
      'S007',
      'PUN1',
      'CONTRACT_PO',
      '2026-11-03 12:00', // 26 hours later > 24 hours
      15000
    );

    expect(po1).toBe('PO-0001');
    expect(po2).toBe('PO-0002'); // Different PO ID!
  });

  it('does NOT consolidate requirements for different plants or different routes', () => {
    const engine = new POConsolidationEngine(24);

    const po1 = engine.assignPO(
      'REQ-0001',
      'S007',
      'PUN1',
      'CONTRACT_PO',
      '2026-11-02 10:00',
      10000
    );

    const po2 = engine.assignPO(
      'REQ-0002',
      'S007',
      'CHK1', // Different plant
      'CONTRACT_PO',
      '2026-11-02 12:00',
      15000
    );

    const po3 = engine.assignPO(
      'REQ-0003',
      'S007',
      'PUN1',
      'SPOT_PO', // Different route
      '2026-11-02 13:00',
      12000
    );

    expect(po1).toBe('PO-0001');
    expect(po2).toBe('PO-0002');
    expect(po3).toBe('PO-0003');
  });
});
