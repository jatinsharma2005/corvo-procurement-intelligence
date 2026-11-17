import { describe, it, expect } from 'vitest';
import { clubPRLines } from '../../apps/api/src/engines/requirement-clubbing';
import { PurchaseRequestLine } from '@corvo/shared-types';

describe('Requirement Clubbing Engine (Policy Section 2)', () => {
  it('combines PR lines with same item, plant, within 14 days and within 7 days need-by (Worked Example 5)', () => {
    const lines: PurchaseRequestLine[] = [
      {
        pr_no: 'PR-26-00146',
        pr_line: 1,
        created_at: '2026-11-02 09:40',
        requester: 'User A',
        department: 'Stores',
        plant: 'CHK1',
        item_code: 'ITM-1038',
        resolved_item_code: 'ITM-1038',
        description: 'Hydraulic oil HLP 68',
        quantity: 270,
        uom: 'LTR',
        need_by_date: '2026-11-19',
        urgency: 'Normal'
      },
      {
        pr_no: 'PR-26-00144',
        pr_line: 1,
        created_at: '2026-11-03 09:30',
        requester: 'User B',
        department: 'Stores',
        plant: 'CHK1',
        item_code: 'ITM-1038',
        resolved_item_code: 'ITM-1038',
        description: 'Hydraulic oil HLP 68',
        quantity: 190,
        uom: 'LTR',
        need_by_date: '2026-11-15',
        urgency: 'Normal'
      },
      {
        pr_no: 'PR-26-00145',
        pr_line: 1,
        created_at: '2026-11-05 08:40',
        requester: 'User C',
        department: 'Stores',
        plant: 'CHK1',
        item_code: 'ITM-1038',
        resolved_item_code: 'ITM-1038',
        description: 'Hydraulic oil HLP 68',
        quantity: 300,
        uom: 'LTR',
        need_by_date: '2026-11-21',
        urgency: 'Normal'
      }
    ];

    const { groups } = clubPRLines(lines);
    expect(groups.length).toBe(1);
    expect(groups[0].total_quantity).toBe(760);
    expect(groups[0].lines.length).toBe(3);
  });

  it('does NOT combine PR lines for different plants (Worked Example 6)', () => {
    const lines: PurchaseRequestLine[] = [
      {
        pr_no: 'PR-26-00106',
        pr_line: 1,
        created_at: '2026-11-02 12:00',
        requester: 'User A',
        department: 'Stores',
        plant: 'PUN1',
        resolved_item_code: 'ITM-1044',
        description: 'VCI bag 600x900',
        quantity: 7370,
        uom: 'NOS',
        need_by_date: '2027-02-19',
        urgency: 'Normal'
      },
      {
        pr_no: 'PR-26-00103',
        pr_line: 1,
        created_at: '2026-11-05 08:50',
        requester: 'User B',
        department: 'Stores',
        plant: 'CHK1',
        resolved_item_code: 'ITM-1044',
        description: 'vci bag 600x900',
        quantity: 6480,
        uom: 'NOS',
        need_by_date: '2027-03-04',
        urgency: 'Normal'
      }
    ];

    const { groups } = clubPRLines(lines);
    expect(groups.length).toBe(2);
    expect(groups[0].plant).toBe('PUN1');
    expect(groups[1].plant).toBe('CHK1');
  });

  it('marks entire requirement group as Emergency if any line is Emergency (Section 2.3)', () => {
    const lines: PurchaseRequestLine[] = [
      {
        pr_no: 'PR-1',
        pr_line: 1,
        created_at: '2026-11-01 10:00',
        requester: 'A',
        department: 'Maint',
        plant: 'PUN1',
        resolved_item_code: 'ITM-1026',
        description: 'Seal',
        quantity: 10,
        uom: 'NOS',
        need_by_date: '2026-11-10',
        urgency: 'Normal'
      },
      {
        pr_no: 'PR-2',
        pr_line: 1,
        created_at: '2026-11-02 10:00',
        requester: 'B',
        department: 'Maint',
        plant: 'PUN1',
        resolved_item_code: 'ITM-1026',
        description: 'Seal',
        quantity: 20,
        uom: 'NOS',
        need_by_date: '2026-11-12',
        urgency: 'Emergency'
      }
    ];

    const { groups } = clubPRLines(lines);
    expect(groups.length).toBe(1);
    expect(groups[0].is_emergency).toBe(true);
  });

  it('never clubs NEW items (Section 1.2)', () => {
    const lines: PurchaseRequestLine[] = [
      {
        pr_no: 'PR-10',
        pr_line: 1,
        created_at: '2026-11-01 10:00',
        requester: 'A',
        department: 'Stores',
        plant: 'PUN1',
        resolved_item_code: 'NEW',
        description: 'Custom Widget A',
        quantity: 5,
        uom: 'NOS',
        need_by_date: '2026-11-10',
        urgency: 'Normal'
      },
      {
        pr_no: 'PR-11',
        pr_line: 1,
        created_at: '2026-11-01 11:00',
        requester: 'B',
        department: 'Stores',
        plant: 'PUN1',
        resolved_item_code: 'NEW',
        description: 'Custom Widget B',
        quantity: 5,
        uom: 'NOS',
        need_by_date: '2026-11-10',
        urgency: 'Normal'
      }
    ];

    const { groups } = clubPRLines(lines);
    expect(groups.length).toBe(2);
  });
});
