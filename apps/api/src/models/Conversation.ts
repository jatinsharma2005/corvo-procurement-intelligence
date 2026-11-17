import { Schema, model, Document } from 'mongoose';

export interface IConversation extends Document {
  id: string;
  user_id: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: any;
  }>;
}

const ConversationSchema = new Schema<IConversation>(
  {
    user_id: { type: String, required: true, index: true },
    title: { type: String, required: true },
    messages: [
      {
        id: { type: String, required: true },
        role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        metadata: { type: Schema.Types.Mixed }
      }
    ]
  },
  { timestamps: true }
);

export const ConversationModel = model<IConversation>('Conversation', ConversationSchema);
