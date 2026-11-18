'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  RefreshCw,
  Info,
  Calendar,
  Building,
  Tag,
  Check,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api-client';
import { formatINR, formatDate, getRouteBadge } from '@/lib/utils';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  extracted?: {
    item_code?: string;
    item_description?: string;
    quantity?: number;
    uom?: string;
    plant?: 'PUN1' | 'CHK1';
    need_by_date?: string;
    urgency?: 'NORMAL' | 'URGENT' | 'EMERGENCY';
    estimated_unit_price?: number;
    confidence?: number;
    missing_fields?: string[];
  };
  candidate_items?: Array<{
    item_code: string;
    description: string;
    confidence: number;
    standard_price?: number;
    category?: string;
  }>;
  isConfirmationReady?: boolean;
}

export default function ChatIntakePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      content:
        'Hello! I am Corvo, your automated procurement assistant. Tell me what items or materials you need for your plant operations (e.g. "Need 25 pcs of 6308 ball bearing for Pune by next Friday, machine down"). I will match items against our master catalog, verify rate contracts, and route your request according to company policy.',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string>(`conv-${Date.now()}`);
  const [confirmedPR, setConfirmedPR] = useState<any | null>(null);

  // Editable confirmation card state
  const [editingItem, setEditingItem] = useState<{
    item_code: string;
    item_description: string;
    quantity: number;
    uom: string;
    plant: 'PUN1' | 'CHK1';
    need_by_date: string;
    urgency: 'NORMAL' | 'URGENT' | 'EMERGENCY';
    estimated_unit_price: number;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, editingItem, confirmedPR]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsTyping(true);

    try {
      const res = await api.sendChatMessage(text, conversationId);
      const extracted: any = res.extracted || {};
      const candidateItems = res.candidate_items || [];
      const replyContent = typeof res.message === 'string'
        ? res.message
        : ((res.message as any)?.content || (res.extracted as any)?.assistant_reply || 'I have processed your request.');

      const assistantMsg: ChatMessage = {
        id: `msg-resp-${Date.now()}`,
        sender: 'assistant',
        content: replyContent,
        timestamp: new Date(),
        extracted,
        candidate_items: candidateItems,
        isConfirmationReady: !extracted.missing_fields || extracted.missing_fields.length === 0,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If extracted info has enough info, set editingItem
      if (extracted.item_code || extracted.description || extracted.item_description) {
        setEditingItem({
          item_code: extracted.item_code || (candidateItems[0]?.item_code ?? 'NEW'),
          item_description: extracted.description || extracted.item_description || (candidateItems[0]?.description ?? text),
          quantity: extracted.quantity || 1,
          uom: extracted.uom || 'EA',
          plant: extracted.plant === 'CHK1' ? 'CHK1' : 'PUN1',
          need_by_date: extracted.need_by_date || new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
          urgency: extracted.urgency?.toUpperCase() === 'EMERGENCY' ? 'EMERGENCY' : extracted.urgency?.toUpperCase() === 'URGENT' ? 'URGENT' : 'NORMAL',
          estimated_unit_price: extracted.estimated_unit_price || candidateItems[0]?.standard_price || 0,
        });
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'assistant',
          content: `Apologies, I encountered an error: ${err.message}. Please try again or provide more details.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSelectCandidate = (item: { item_code: string; description: string; standard_price?: number }) => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      item_code: item.item_code,
      item_description: item.description,
      estimated_unit_price: item.standard_price || editingItem.estimated_unit_price,
    });
  };

  const handleConfirmPR = async () => {
    if (!editingItem) return;
    setIsTyping(true);
    try {
      const res = await api.confirmPurchaseRequest(conversationId, editingItem);
      setConfirmedPR(res.purchase_request);
      setEditingItem(null);

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-confirmed-${Date.now()}`,
          sender: 'assistant',
          content: `Purchase Request ${res.purchase_request.pr_no || 'submitted'} has been successfully registered and evaluated by the policy engine!`,
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      alert(`Error confirming request: ${err.message}`);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Header
        title="Procurement Intake Assistant"
        subtitle="Conversational PR Generation with Deterministic Catalog Matching & Policy Routing"
      />

      <main className="flex-1 max-w-5xl mx-auto w-full p-6 flex flex-col gap-6">
        {/* Chat History Container */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 overflow-y-auto space-y-6 min-h-[460px]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[78%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed space-y-3 ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-none'
                }`}
              >
                <div>{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}</div>

                {/* Candidate Items Badges */}
                {msg.candidate_items && msg.candidate_items.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      <span>Identified Catalog Matches:</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {msg.candidate_items.map((cand) => (
                        <button
                          key={cand.item_code}
                          onClick={() => handleSelectCandidate(cand)}
                          className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-left transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-blue-600">
                              {cand.item_code}
                            </span>
                            <span className="text-xs text-slate-800">{cand.description}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {cand.standard_price && (
                              <span className="text-xs font-semibold text-slate-600">
                                {formatINR(cand.standard_price)}
                              </span>
                            )}
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                              {Math.round((cand.confidence ?? 0.95) * 100)}% Match
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-4 items-center text-slate-400 text-xs">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 px-4 py-2 rounded-xl">
                <span>Corvo is matching items & checking policy rules...</span>
              </div>
            </div>
          )}

          {/* PR Confirmation Card */}
          {editingItem && !confirmedPR && (
            <div className="bg-blue-50/70 border-2 border-blue-200 rounded-2xl p-5 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-blue-200 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-blue-900">Purchase Request Preview & Confirmation</h3>
                </div>
                <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
                  Ready to Submit
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-slate-500 font-medium block mb-1">Item Code & Name</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingItem.item_code}
                      onChange={(e) => setEditingItem({ ...editingItem, item_code: e.target.value })}
                      className="w-28 font-mono bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold"
                    />
                    <input
                      type="text"
                      value={editingItem.item_description}
                      onChange={(e) => setEditingItem({ ...editingItem, item_description: e.target.value })}
                      className="flex-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 font-medium block mb-1">Quantity & UOM</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={editingItem.quantity}
                      min={1}
                      onChange={(e) => setEditingItem({ ...editingItem, quantity: Number(e.target.value) })}
                      className="w-28 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold"
                    />
                    <input
                      type="text"
                      value={editingItem.uom}
                      onChange={(e) => setEditingItem({ ...editingItem, uom: e.target.value })}
                      className="w-20 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 font-medium block mb-1">Plant Location</label>
                  <select
                    value={editingItem.plant}
                    onChange={(e) => setEditingItem({ ...editingItem, plant: e.target.value as any })}
                    className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium"
                  >
                    <option value="PUN1">PUN1 — Pune Plant</option>
                    <option value="CHK1">CHK1 — Chakan Assembly</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-500 font-medium block mb-1">Need-By Date</label>
                  <input
                    type="date"
                    value={editingItem.need_by_date}
                    onChange={(e) => setEditingItem({ ...editingItem, need_by_date: e.target.value })}
                    className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="text-slate-500 font-medium block mb-1">Urgency</label>
                  <select
                    value={editingItem.urgency}
                    onChange={(e) => setEditingItem({ ...editingItem, urgency: e.target.value as any })}
                    className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-700"
                  >
                    <option value="NORMAL">Normal Operation</option>
                    <option value="URGENT">Urgent Requirement</option>
                    <option value="EMERGENCY">Emergency (Line Down)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-500 font-medium block mb-1">Estimated Unit Price (INR)</label>
                  <input
                    type="number"
                    value={editingItem.estimated_unit_price}
                    onChange={(e) => setEditingItem({ ...editingItem, estimated_unit_price: Number(e.target.value) })}
                    className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-blue-200 flex items-center justify-between">
                <div className="text-xs text-blue-900">
                  Total Estimated Valuation:{' '}
                  <span className="font-bold text-sm">
                    {formatINR(editingItem.quantity * editingItem.estimated_unit_price)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingItem(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPR}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirm & Route Request</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Successfully Confirmed PR Result Banner */}
          {confirmedPR && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Purchase Request Confirmed & Evaluated</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">PR Number:</span>
                  <div className="font-mono font-bold text-slate-800">{confirmedPR.pr_no || 'PR-2026-LIVE'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Item:</span>
                  <div className="font-semibold text-slate-800">{confirmedPR.item_code}</div>
                </div>
                <div>
                  <span className="text-slate-500">Plant:</span>
                  <div className="font-semibold text-slate-800">{confirmedPR.plant}</div>
                </div>
                <div>
                  <span className="text-slate-500">Quantity:</span>
                  <div className="font-semibold text-slate-800">{confirmedPR.quantity} {confirmedPR.uom}</div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar & Preset Suggestion Chips */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-slate-400 font-medium py-1">Quick prompts:</span>
            <button
              onClick={() => handleSend('Need 25 pcs of 6308 deep groove ball bearing for Pune plant by next Friday. Machine is down.')}
              className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              25x Ball Bearing 6308 (PUN1, Emergency)
            </button>
            <button
              onClick={() => handleSend('Requesting 50 pcs of safety goggles for Chakan assembly plant.')}
              className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              50x Safety Goggles (CHK1)
            </button>
            <button
              onClick={() => handleSend('Need 1 unit drinking water purifier 50 LPH for Pune plant.')}
              className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              1x Water Purifier (New Item)
            </button>
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your request (e.g. 'Need 10 boxes hydraulic oil for PUN1 plant need-by 15-Nov')..."
              className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all"
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isTyping}
              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm shadow-sm inline-flex items-center gap-2 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
