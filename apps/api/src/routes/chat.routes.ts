import { Router, Response } from 'express';
import { ChatService } from '../services/chat.service';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();
const chatService = new ChatService();

router.post('/message', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { content, conversation_id } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  const convId = conversation_id || `conv-${Date.now()}`;
  const userId = req.user?.id || 'usr-anonymous';

  try {
    const result = await chatService.handleMessage(convId, userId, content);
    const replyText = typeof result.message === 'string'
      ? result.message
      : (result.message?.content || result.extracted?.assistant_reply || 'I have processed your request.');

    return res.json({
      conversation_id: convId,
      message: replyText,
      message_obj: result.message,
      extracted: result.extracted,
      candidate_items: result.candidateItems
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/confirm', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { conversation_id, pr_data } = req.body;
  if (!conversation_id || !pr_data) {
    return res.status(400).json({ error: 'Conversation ID and PR data are required' });
  }

  try {
    const pr = await chatService.confirmPR(conversation_id, {
      ...pr_data,
      requester: req.user?.name || pr_data.requester || 'Employee'
    });
    return res.json({ success: true, purchase_request: pr });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/conversations', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const convs = await chatService.getConversations(req.user?.id);
    return res.json({ conversations: convs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const chatRoutes = router;
