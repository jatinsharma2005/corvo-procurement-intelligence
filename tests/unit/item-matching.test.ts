import { describe, it, expect, beforeAll } from 'vitest';
import { ItemMatchingEngine } from '../../apps/api/src/engines/item-matching';
import { Item } from '@corvo/shared-types';

describe('Item Matching Engine', () => {
  let engine: ItemMatchingEngine;

  const sampleItems: Item[] = [
    { item_code: 'ITM-1021', description: 'Ball bearing 6205-2RS', uom: 'NOS', category: 'Bearings & Transmission', item_type: 'Material', standard_price: 210 },
    { item_code: 'ITM-1022', description: 'Ball bearing 6308-ZZ', uom: 'NOS', category: 'Bearings & Transmission', item_type: 'Material', standard_price: 640 },
    { item_code: 'ITM-1023', description: 'Taper roller bearing 32210', uom: 'NOS', category: 'Bearings & Transmission', item_type: 'Material', standard_price: 1450 },
    { item_code: 'ITM-1035', description: 'Hydraulic hose 1/2 inch 2 wire', uom: 'MTR', category: 'Hydraulics & Pneumatics', item_type: 'Material', standard_price: 420 },
    { item_code: 'ITM-1066', description: 'CMM calibration service', uom: 'JOB', category: 'Testing & Calibration', item_type: 'Service', standard_price: 65000 },
    { item_code: 'ITM-1071', description: 'EOT crane 5 ton', uom: 'NOS', category: 'Capital Equipment', item_type: 'Capex', standard_price: 1450000 }
  ];

  beforeAll(() => {
    engine = new ItemMatchingEngine(sampleItems);
  });

  it('matches exact item code if supplied', () => {
    const res = engine.match('ITM-1021', 'Random description');
    expect(res.resolved_item_code).toBe('ITM-1021');
    expect(res.is_new).toBe(false);
    expect(res.confidence).toBe(1.0);
  });

  it('matches free text abbreviations: "brg 6205 2rs"', () => {
    const res = engine.match(undefined, 'brg 6205 2rs');
    expect(res.resolved_item_code).toBe('ITM-1021');
    expect(res.is_new).toBe(false);
  });

  it('matches free text with noise: "brg 6308 ZZ for maintenance"', () => {
    const res = engine.match(undefined, 'brg 6308 ZZ for maintenance');
    expect(res.resolved_item_code).toBe('ITM-1022');
    expect(res.is_new).toBe(false);
  });

  it('matches free text abbreviation: "hyd hose 1/2 inch 2 wire"', () => {
    const res = engine.match(undefined, 'hyd hose 1/2 inch 2 wire');
    expect(res.resolved_item_code).toBe('ITM-1035');
    expect(res.is_new).toBe(false);
  });

  it('identifies genuinely unknown items as NEW', () => {
    const res = engine.match(undefined, 'Drinking water purifier 50 LPH');
    expect(res.resolved_item_code).toBe('NEW');
    expect(res.is_new).toBe(true);
  });

  it('identifies uncatalogued tools as NEW', () => {
    const res = engine.match(undefined, 'Ultrasonic thickness gauge');
    expect(res.resolved_item_code).toBe('NEW');
    expect(res.is_new).toBe(true);
  });
});
