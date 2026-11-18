import { describe, it, expect, beforeAll } from 'vitest';
import { ChatService } from '../../apps/api/src/services/chat.service';
import { PurchaseRequestLineModel } from '../../apps/api/src/models/PurchaseRequest';
import { connectDatabase } from '../../apps/api/src/models';

describe('Phase Five: Chat Intake End-to-End Test Suite', () => {
  let chatService: ChatService;

  beforeAll(async () => {
    await connectDatabase();
    chatService = new ChatService();
  });

  it('Example 1: "I need 200 nitrile gloves for Chakan by next Friday"', async () => {
    const convId = `test-chat-${Date.now()}`;
    const result = await chatService.handleMessage(
      convId,
      'emp-001',
      'I need 200 nitrile gloves for Chakan by next Friday'
    );

    expect(result.extracted).toBeDefined();
    expect(result.extracted.quantity).toBe(200);
    expect(result.extracted.plant).toBe('CHK1');
    expect(result.extracted.need_by_date).toBeDefined();
    expect(result.extracted.urgency).toBe('Normal');
    // Nitrile gloves should match ITM-1048
    expect(result.extracted.item_code).toBe('ITM-1048');
    expect(result.extracted.missing_fields.length).toBe(0);

    // Confirm PR
    const confirmed = await chatService.confirmPR(convId, {
      item_code: result.extracted.item_code,
      description: 'Nitrile coated gloves',
      quantity: result.extracted.quantity,
      plant: result.extracted.plant as any,
      need_by_date: result.extracted.need_by_date,
      urgency: 'Normal'
    });

    expect(confirmed).toBeDefined();
    expect(confirmed.pr_no).toMatch(/^PR-\d{2}-\d{5}$/);
    expect(confirmed.quantity).toBe(200);
    expect(confirmed.plant).toBe('CHK1');

    // Verify persisted in DB
    const persisted = await PurchaseRequestLineModel.findOne({ pr_no: confirmed.pr_no }).lean();
    expect(persisted).toBeDefined();
    expect(persisted?.quantity).toBe(200);
  });

  it('Example 2: Handles vague descriptions and prompts for missing information', async () => {
    const convId = `test-chat-vague-${Date.now()}`;
    const result = await chatService.handleMessage(
      convId,
      'emp-002',
      'I need some industrial lubricants'
    );

    expect(result.extracted.missing_fields).toContain('quantity');
    expect(result.extracted.missing_fields).toContain('plant');
    expect(result.extracted.missing_fields).toContain('need_by_date');
    expect(result.message.content).toContain('quantity');
  });

  it('Example 3: Handles unknown catalog item cleanly', async () => {
    const convId = `test-chat-unknown-${Date.now()}`;
    const result = await chatService.handleMessage(
      convId,
      'emp-003',
      'Need 1 unit drinking water purifier 50 LPH for Pune by next Friday'
    );

    expect(result.extracted.quantity).toBe(1);
    expect(result.extracted.plant).toBe('PUN1');
    // Candidate items or new item handling
    expect(result.candidateItems).toBeDefined();
  });
});
