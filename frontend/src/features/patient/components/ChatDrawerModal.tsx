import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  MessageSquare,
  Clock,
  CheckCheck,
  Loader2,
  ShieldCheck,
  Stethoscope,
  Sparkles,
  FileText,
  Calendar,
  HelpCircle,
  AlertTriangle,
  Lock,
  Paperclip,
  Square,
} from 'lucide-react';
import { api } from '../../../services/api';

interface ChatDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: any;
  triggerToast: (type: 'success' | 'error', message: string) => void;
}

export const ChatDrawerModal: React.FC<ChatDrawerModalProps> = ({
  isOpen,
  onClose,
  appointment,
  triggerToast,
}) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [clickedChipIndex, setClickedChipIndex] = useState<number | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const isSendingRef = useRef(false);
  const isTypingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentTempIdRef = useRef<string | null>(null);

  isSendingRef.current = isSending;
  isTypingRef.current = isTyping;

  const handleStopMessage = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsSending(false);
    setIsTyping(false);
    if (currentTempIdRef.current) {
      const tempIdToRemove = currentTempIdRef.current;
      setMessages((prev) => prev.filter((m) => m.id !== tempIdToRemove));
      currentTempIdRef.current = null;
    }
    triggerToast('error', 'Response generation stopped by user.');
  };

  const currentUserId = (() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.id;
      }
    } catch (e) {
      console.error('Error parsing stored user:', e);
    }
    return null;
  })();

  const fetchChatHistory = async (showSpinner = false) => {
    const targetApptId = appointment?.id || appointment?.appointment_id;
    if (!targetApptId) {
      setIsLoading(false);
      return;
    }
    if (isSendingRef.current || isTypingRef.current) return;
    if (showSpinner && messages.length === 0) setIsLoading(true);

    try {
      const res = await api.get(`/chat/history/${targetApptId}`);
      if (res.data && res.data.success && !isSendingRef.current && !isTypingRef.current) {
        setMessages(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching chat history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const targetApptId = appointment?.id || appointment?.appointment_id;
    if (isOpen && targetApptId) {
      fetchChatHistory(messages.length === 0);
      const interval = setInterval(() => {
        fetchChatHistory(false);
      }, 6000);
      return () => clearInterval(interval);
    } else if (isOpen) {
      setIsLoading(false);
    }
  }, [isOpen, appointment?.id, appointment?.appointment_id]);

  // Safety fallback: Ensure spinner never stays stuck on screen for more than 1.2 seconds
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent, customText?: string, chipIndex?: number) => {
    if (e) e.preventDefault();
    const text = (customText || inputText).trim();
    const targetApptId = appointment?.id || appointment?.appointment_id;
    if (!text || !targetApptId || isSending) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (chipIndex !== undefined) {
      setClickedChipIndex(chipIndex);
      setTimeout(() => setClickedChipIndex(null), 700);
    }

    // Step 1: Append User Question FIRST to the chat feed (0ms)
    const tempId = `temp-${Date.now()}`;
    currentTempIdRef.current = tempId;

    const optimisticMsg = {
      id: tempId,
      appointment_id: targetApptId,
      sender_id: currentUserId,
      sender_name: 'You',
      sender_role: 'patient',
      message_text: text,
      is_read: false,
      created_at: new Date().toISOString(),
      isOptimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');
    setIsSending(true);

    // Immediate scroll to user question
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);

    // Step 2: Short 300ms natural pause AFTER question appears, THEN show Doctor typing indicator
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (controller.signal.aborted) return;
    setIsTyping(true);

    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);

    try {
      const res = await api.post(
        '/chat/send',
        {
          appointment_id: targetApptId,
          message_text: text,
        },
        { signal: controller.signal }
      );

      // Step 3: Keep typing animation active for 500ms for realistic typing feel
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (controller.signal.aborted) return;

      if (res.data && res.data.success) {
        // Fetch new chat history WHILE isTyping is STILL true so there is zero gap!
        const histRes = await api.get(`/chat/history/${targetApptId}`, { signal: controller.signal });
        if (histRes.data && histRes.data.success && !controller.signal.aborted) {
          // Replace responding indicator directly with doctor's reply in the same render frame!
          setMessages(histRes.data.data || []);
          setIsTyping(false);
        } else {
          setIsTyping(false);
        }
      } else {
        setIsTyping(false);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        triggerToast('error', res.data?.message || 'Failed to send message.');
      }
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError' || controller.signal.aborted) {
        console.log('Message processing stopped by user');
        return;
      }
      console.error('Error sending message:', err);
      setIsTyping(false);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      triggerToast('error', err.response?.data?.message || 'Error sending message.');
    } finally {
      if (!controller.signal.aborted) {
        setIsSending(false);
        setIsTyping(false);
        currentTempIdRef.current = null;
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      }
    }
  };

  if (!isOpen || !appointment) return null;

  const doctorName = appointment.doctor_name
    ? (appointment.doctor_name.toLowerCase().startsWith('dr') ? appointment.doctor_name : `Dr. ${appointment.doctor_name}`)
    : 'Clinic Support Desk';

  const docInitials = doctorName
    .replace('Dr. ', '')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const quickPrompts = [
    { icon: <FileText size={13} />, label: 'X-Ray Report Update', text: 'Have you checked my X-ray report file?' },
    { icon: <Calendar size={13} />, label: 'Confirm Slot', text: 'Can you please confirm my consultation slot timing?' },
    { icon: <HelpCircle size={13} />, label: 'Pre-visit Guide', text: 'Are there any pre-visit instructions I should follow?' },
    { icon: <AlertTriangle size={13} />, label: 'Urgent Query', text: 'I am experiencing acute discomfort, please review.' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1200,
        display: 'flex',
        justifyContent: 'flex-end',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes popInMessage {
          0% { opacity: 0; transform: translateY(12px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes typingDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
          40% { transform: scale(1.15); opacity: 1; }
        }
        .typing-dot-1 { animation: typingDot 1.4s infinite ease-in-out 0s; }
        .typing-dot-2 { animation: typingDot 1.4s infinite ease-in-out 0.2s; }
        .typing-dot-3 { animation: typingDot 1.4s infinite ease-in-out 0.4s; }
        .message-popin { animation: popInMessage 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: '490px',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-16px 0 40px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          borderTopLeftRadius: '20px',
          borderBottomLeftRadius: '20px',
          overflow: 'hidden',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* ── 1. Executive Medical Header ── */}
        <div
          style={{
            padding: '20px 24px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0f766e 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            position: 'relative',
          }}
        >
          {/* Ambient Glow Effect */}
          <div
            style={{
              position: 'absolute',
              top: '-40px',
              right: '-20px',
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, rgba(255,255,255,0) 70%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative', zIndex: 1 }}>
            {/* Avatar with Animated Online Status */}
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1rem',
                  letterSpacing: '0.03em',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
                  border: '2px solid rgba(255, 255, 255, 0.35)',
                }}
              >
                {docInitials || 'DR'}
              </div>
              <span
                title="Desk Active & Live"
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  border: '2px solid #0f172a',
                  boxShadow: '0 0 8px #10b981',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
                  {doctorName}
                </h3>
                <span title="Verified Doctor & Support Desk">
                  <ShieldCheck size={17} style={{ color: '#38bdf8' }} />
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'rgba(241, 245, 249, 0.85)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '3px',
                  fontWeight: 500,
                }}
              >
                <Stethoscope size={13} style={{ color: '#5eead4' }} />
                <span>Consultation &amp; Clinical Support</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Close Chat"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '9px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              position: 'relative',
              zIndex: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.22)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── 2. Context Status Pill Banner ── */}
        <div
          style={{
            padding: '11px 22px',
            background: 'linear-gradient(90deg, #f0f9ff 0%, #e0f2fe 100%)',
            borderBottom: '1px solid #bae6fd',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.81rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                fontWeight: 700,
                backgroundColor: '#ffffff',
                color: '#0369a1',
                padding: '3px 9px',
                borderRadius: '6px',
                border: '1px solid #7dd3fc',
                fontSize: '0.76rem',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              APP-{appointment.id.substring(0, 8).toUpperCase()}
            </span>
            <span style={{ color: '#0369a1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0284c7', display: 'inline-block' }} />
              Active Session
            </span>
          </div>

          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              color: '#0c4a6e',
              fontWeight: 600,
              fontSize: '0.78rem',
            }}
          >
            <Clock size={13} style={{ color: '#0284c7' }} />
            {appointment.scheduled_time || `${appointment.date || 'Today'}`}
          </span>
        </div>

        {/* ── 3. Chat Messages Body ── */}
        <div
          style={{
            flex: 1,
            padding: '22px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
          }}
        >
          {/* Day Divider Pill */}
          <div style={{ textAlign: 'center', margin: '2px 0 8px 0' }}>
            <span
              style={{
                fontSize: '0.71rem',
                color: '#64748b',
                fontWeight: 700,
                backgroundColor: '#ffffff',
                padding: '5px 16px',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Today's Consultation Desk Session
            </span>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', color: '#64748b', marginTop: '70px', fontSize: '0.9rem' }}>
              <Loader2 size={28} className="spin" style={{ margin: '0 auto 12px', color: '#0ea5e9', display: 'block' }} />
              Connecting to secure medical chat...
            </div>
          ) : messages.length === 0 && !isTyping ? (
            <div
              style={{
                textAlign: 'center',
                margin: 'auto 0',
                padding: '38px 24px',
                backgroundColor: '#ffffff',
                borderRadius: '18px',
                border: '1px dashed #cbd5e1',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '58px',
                  height: '58px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.15)',
                }}
              >
                <MessageSquare size={28} />
              </div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 }}>
                Direct Messaging Active
              </h4>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b', lineHeight: 1.55 }}>
                Send your medical queries, symptoms, or diagnostic file updates directly to {doctorName}.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg: any) => {
                const isMe = msg.sender_id === currentUserId || msg.sender_role === 'patient';
                const formattedTime = new Date(msg.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={msg.id}
                    className="message-popin"
                    style={{
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                      opacity: msg.isOptimistic ? 0.9 : 1,
                      transition: 'opacity 0.2s ease',
                    }}
                  >
                    {/* Sender Label */}
                    <div
                      style={{
                        fontSize: '0.74rem',
                        color: isMe ? '#0284c7' : '#0f766e',
                        marginBottom: '4px',
                        fontWeight: 700,
                        paddingLeft: isMe ? 0 : '4px',
                        paddingRight: isMe ? '4px' : 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {!isMe && <Sparkles size={12} style={{ color: '#0d9488' }} />}
                      {isMe ? 'You' : msg.sender_name || doctorName}
                    </div>

                    {/* Message Bubble */}
                    <div
                      style={{
                        padding: '13px 17px',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isMe
                          ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                          : '#ffffff',
                        color: isMe ? '#ffffff' : '#1e293b',
                        fontSize: '0.91rem',
                        lineHeight: 1.55,
                        boxShadow: isMe
                          ? '0 4px 16px rgba(2, 132, 199, 0.28)'
                          : '0 4px 14px rgba(0, 0, 0, 0.05)',
                        border: isMe ? 'none' : '1px solid #e2e8f0',
                        wordBreak: 'break-word',
                        fontWeight: 500,
                      }}
                    >
                      {msg.message_text}
                    </div>

                    {/* Time & Read Status */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.69rem',
                        color: '#94a3b8',
                        marginTop: '5px',
                        paddingLeft: isMe ? 0 : '4px',
                        paddingRight: isMe ? '4px' : 0,
                        fontWeight: 500,
                      }}
                    >
                      <Clock size={11} />
                      <span>{formattedTime}</span>
                      {isMe && (
                        <CheckCheck
                          size={14}
                          style={{ color: msg.is_read ? '#0284c7' : '#94a3b8', marginLeft: '2px' }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* ── Realistic Doctor Typing Indicator Animation ── */}
              {isTyping && (
                <div
                  className="message-popin"
                  style={{
                    alignSelf: 'flex-start',
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    marginTop: '4px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.74rem',
                      color: '#0f766e',
                      marginBottom: '4px',
                      fontWeight: 700,
                      paddingLeft: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Sparkles size={12} style={{ color: '#0d9488' }} />
                    {doctorName}
                  </div>

                  <div
                    style={{
                      padding: '11px 18px',
                      borderRadius: '18px 18px 18px 4px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>responding</span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginLeft: '2px' }}>
                      <span className="typing-dot-1" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0284c7', display: 'inline-block' }} />
                      <span className="typing-dot-2" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0ea5e9', display: 'inline-block' }} />
                      <span className="typing-dot-3" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0f766e', display: 'inline-block' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* ── 4. Sleek Quick Suggestions Chips ── */}
        <div
          style={{
            padding: '10px 18px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isSending}
              onClick={(e) => handleSendMessage(e, p.text, idx)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '24px',
                backgroundColor: clickedChipIndex === idx ? '#e0f2fe' : '#f8fafc',
                border: `1px solid ${clickedChipIndex === idx ? '#0284c7' : '#cbd5e1'}`,
                color: '#0284c7',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: isSending ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                transform: clickedChipIndex === idx ? 'scale(0.96)' : 'scale(1)',
              }}
              onMouseEnter={(e) => {
                if (!isSending) {
                  e.currentTarget.style.backgroundColor = '#f0f9ff';
                  e.currentTarget.style.borderColor = '#0284c7';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSending) {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {clickedChipIndex === idx ? <Loader2 size={13} className="spin" /> : p.icon}
              {p.label}
            </button>
          ))}
        </div>

        {/* ── 5. Executive Input Bar & Footer ── */}
        <div style={{ backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
          <form
            onSubmit={handleSendMessage}
            style={{
              padding: '14px 20px 8px 20px',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
            }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isSending || isTyping ? 'Response in progress... Click stop to cancel' : 'Type your query to clinic support...'}
                disabled={isSending || isTyping}
                style={{
                  width: '100%',
                  padding: '12px 18px 12px 42px',
                  borderRadius: '28px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.91rem',
                  outline: 'none',
                  backgroundColor: isSending || isTyping ? '#f1f5f9' : '#f8fafc',
                  color: '#0f172a',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  if (!isSending && !isTyping) {
                    e.currentTarget.style.borderColor = '#0284c7';
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(2, 132, 199, 0.12)';
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.backgroundColor = isSending || isTyping ? '#f1f5f9' : '#f8fafc';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <Paperclip
                size={18}
                style={{
                  position: 'absolute',
                  left: '15px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
            </div>

            <button
              type={isSending || isTyping ? 'button' : 'submit'}
              onClick={isSending || isTyping ? handleStopMessage : undefined}
              title={isSending || isTyping ? 'Stop Response' : 'Send Message'}
              disabled={!isSending && !isTyping && !inputText.trim()}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: isSending || isTyping
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  : !inputText.trim()
                  ? '#cbd5e1'
                  : 'linear-gradient(135deg, #0284c7 0%, #0f766e 100%)',
                color: '#ffffff',
                border: 'none',
                cursor: !inputText.trim() && !isSending && !isTyping ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                flexShrink: 0,
                boxShadow: isSending || isTyping
                  ? '0 4px 14px rgba(239, 68, 68, 0.4)'
                  : !inputText.trim()
                  ? 'none'
                  : '0 4px 14px rgba(2, 132, 199, 0.35)',
              }}
              onMouseEnter={(e) => {
                if (isSending || isTyping || inputText.trim()) {
                  e.currentTarget.style.transform = 'scale(1.06)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {isSending || isTyping ? (
                <Square size={16} style={{ fill: '#ffffff' }} />
              ) : (
                <Send size={20} />
              )}
            </button>
          </form>

          {/* Encryption Footer Note */}
          <div
            style={{
              padding: '4px 20px 12px 20px',
              textAlign: 'center',
              fontSize: '0.72rem',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              fontWeight: 500,
            }}
          >
            <Lock size={11} style={{ color: '#0ea5e9' }} />
            <span>End-to-end encrypted medical consultation line</span>
          </div>
        </div>
      </div>
    </div>
  );
};

