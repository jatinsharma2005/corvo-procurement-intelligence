import { ConversationModel } from '../models/Conversation';
import { PurchaseRequestLineModel } from '../models/PurchaseRequest';
import { ItemModel } from '../models/Item';
import { AIService, ExtractedChatPR } from './ai.service';
import { ItemMatchingEngine } from '../engines/item-matching';
import { Item, PurchaseRequestLine } from '@corvo/shared-types';
import { DataStore } from './data-store.service';

export class ChatService {
  private aiService: AIService;
  private itemMatchingEngine: ItemMatchingEngine;

  constructor() {
    this.aiService = new AIService();
    this.itemMatchingEngine = new ItemMatchingEngine();
  }

  public async handleMessage(
    conversationId: string,
    userId: string,
    content: string
  ): Promise<{ message: any; extracted: ExtractedChatPR; candidateItems: Item[] }> {
    // 1. Fetch items
    let items: Item[] = [];
    const itemsDocs = await ItemModel.find().lean();
    if (itemsDocs.length > 0) {
      items = itemsDocs.map((d: any) => ({
        item_code: d.item_code,
        description: d.description,
        uom: d.uom,
        category: d.category,
        item_type: d.item_type,
        standard_price: d.standard_price
      }));
    } else {
      await DataStore.getInstance().loadData();
      items = DataStore.getInstance().getItems();
    }
    this.itemMatchingEngine.setCatalog(items);

    // 2. Fetch or create conversation
    let conversation = await ConversationModel.findOne({ id: conversationId });
    if (!conversation) {
      conversation = new ConversationModel({
        id: conversationId,
        user_id: userId,
        title: content.slice(0, 40) + '...',
        messages: []
      });
    }

    const history = conversation.messages.map((m) => ({
      role: m.role,
      content: m.content
    }));

    // 3. Extract PR fields using AI service
    const extracted = await this.aiService.extractPRFromChat(content, history, items);

    // 4. Check candidates if item matching is ambiguous, or populate identified catalog match
    let candidateItems: any[] = [];
    if (extracted.item_code) {
      const match = items.find((i) => i.item_code === extracted.item_code);
      if (match) {
        candidateItems = [{
          ...match,
          confidence: extracted.confidence || 0.98
        }];
      }
    } else if (extracted.description) {
      const matchResult = this.itemMatchingEngine.match(undefined, extracted.description);
      candidateItems = matchResult.candidates.map((c) => ({
        ...c.item,
        confidence: c.score
      }));
    }

    // 5. Append messages
    const userMsg = {
      id: `msg-${Date.now()}-user`,
      role: 'user' as const,
      content,
      timestamp: new Date()
    };

    const assistantMsg = {
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant' as const,
      content: extracted.assistant_reply,
      timestamp: new Date(),
      metadata: {
        extracted_pr: {
          item_code: extracted.item_code,
          description: extracted.description,
          quantity: extracted.quantity,
          plant: extracted.plant,
          need_by_date: extracted.need_by_date,
          urgency: extracted.urgency,
          estimated_unit_price: extracted.estimated_unit_price
        },
        missing_fields: extracted.missing_fields,
        candidate_items: candidateItems
      }
    };

    conversation.messages.push(userMsg as any, assistantMsg as any);
    await conversation.save();

    return {
      message: assistantMsg,
      extracted,
      candidateItems
    };
  }

  public async confirmPR(
    conversationId: string,
    prData: Partial<PurchaseRequestLine>
  ): Promise<PurchaseRequestLine> {
    const prNo = `PR-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(10000 + Math.random() * 90000)}`;

    const match = this.itemMatchingEngine.match(prData.item_code, prData.description);

    const doc = new PurchaseRequestLineModel({
      pr_no: prNo,
      pr_line: 1,
      created_at: new Date(),
      requester: prData.requester || 'Employee',
      department: prData.department || 'Operations',
      plant: prData.plant || 'PUN1',
      item_code: match.is_new ? undefined : match.resolved_item_code,
      description: prData.description || 'Requested Item',
      quantity: prData.quantity || 1,
      uom: prData.uom || 'NOS',
      estimated_unit_price: prData.estimated_unit_price,
      need_by_date: prData.need_by_date ? new Date(prData.need_by_date) : new Date(Date.now() + 7 * 86400000),
      urgency: prData.urgency || 'Normal',
      resolved_item_code: match.resolved_item_code
    });

    await doc.save();

    // Append confirmation to conversation
    await ConversationModel.findOneAndUpdate(
      { id: conversationId },
      {
        $push: {
          messages: {
            id: `msg-${Date.now()}-confirmed`,
            role: 'assistant',
            content: `Purchase Request **${prNo}/1** has been created successfully! It will now be processed against procurement policies.`,
            timestamp: new Date(),
            metadata: { is_confirmed: true, created_pr_no: prNo }
          }
        }
      }
    );

    return {
      pr_no: prNo,
      pr_line: 1,
      created_at: new Date().toISOString(),
      requester: doc.requester,
      department: doc.department,
      plant: doc.plant,
      item_code: doc.item_code,
      description: doc.description,
      quantity: doc.quantity,
      uom: doc.uom,
      estimated_unit_price: doc.estimated_unit_price,
      need_by_date: doc.need_by_date.toISOString().split('T')[0],
      urgency: doc.urgency as any,
      resolved_item_code: doc.resolved_item_code
    };
  }

  public async getConversations(userId?: string): Promise<any[]> {
    try {
      const query = userId ? { user_id: userId } : {};
      return await ConversationModel.find(query).sort({ updatedAt: -1 }).lean();
    } catch {
      return [];
    }
  }
}
