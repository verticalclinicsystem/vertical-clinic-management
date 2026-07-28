import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, Clock, CheckCheck, Loader2, ShieldCheck, Stethoscope, Sparkles, FileText, Calendar, HelpCircle } from 'lucide-react';
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
  const chatBottomRef = useRef<HTMLDivElement>(null);

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
    if (!appointment?.id) return;
    if (showSpinner) setIsLoading(true);
    try {
      const res = await api.get(`/chat/history/${appointment.id}`);
      if (res.data && res.data.success) {
        setMessages(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching chat history:', err);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && appointment?.id) {
      fetchChatHistory(true);
      const interval = setInterval(() => {
        fetchChatHistory(false);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, appointment?.id]);

  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const text = (customText || inputText).trim();
    if (!text || !appointment?.id || isSending) return;

    setIsSending(true);
    try {
      const res = await api.post('/chat/send', {
        appointment_id: appointment.id,
        message_text: text,
      });

      if (res.data && res.data.success) {
        setInputText('');
        await fetchChatHistory(false);
      } else {
        triggerToast('error', res.data?.message || 'Failed to send message.');
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      triggerToast('error', err.response?.data?.message || 'Error sending message.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen || !appointment) return null;

  const doctorName = appointment.doctor_name
    ? (appointment.doctor_name.toLowerCase().startsWith('dr') ? appointment.doctor_name : `Dr. ${appointment.doctor_name}`)
    : 'Clinic Desk';

  const docInitials = doctorName
    .replace('Dr. ', '')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const quickPrompts = [
    { icon: <FileText size={12} />, label: 'X-Ray Report Update', text: 'Have you checked my X-ray report file?' },
    { icon: <Calendar size={12} />, label: 'Check Timings', text: 'Can you please confirm my consultation slot timing?' },
    { icon: <HelpCircle size={12} />, label: 'Pre-consultation Query', text: 'Are there any pre-visit instructions I should follow?' },
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
        backdropFilter: 'blur(6px)',
        zIndex: 1200,
        display: 'flex',
        justifyContent: 'flex-end',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-12px 0 35px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* ── Premium Executive Header ── */}
        <div
          style={{
            padding: '18px 22px',
            background: 'linear-gradient(135deg, #063d51 0%, #0a526d 50%, #0e6685 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle background glow circle */}
          <div
            style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.06)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative', zIndex: 1 }}>
            {/* Avatar with Live Indicator */}
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                }}
              >
                {docInitials || 'DR'}
              </div>
              <span
                style={{
                  position: 'absolute',
                  bottom: '1px',
                  right: '1px',
                  width: '11px',
                  height: '11px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  border: '2px solid #063d51',
                  boxShadow: '0 0 6px #10b981',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
                  {doctorName}
                </h3>
                <ShieldCheck size={16} style={{ color: '#38bdf8' }} />
              </div>
              <span
                style={{
                  fontSize: '0.76rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '2px',
                }}
              >
                <Stethoscope size={13} style={{ color: '#7dd3fc' }} />
                Clinic Support Desk &amp; Consultation Line
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              position: 'relative',
              zIndex: 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Glassmorphism Consultation Context Banner ── */}
        <div
          style={{
            padding: '12px 20px',
            background: 'linear-gradient(90deg, #f0f9ff 0%, #e0f2fe 100%)',
            borderBottom: '1px solid #bae6fd',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                backgroundColor: '#ffffff',
                color: '#0369a1',
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid #7dd3fc',
                fontSize: '0.78rem',
              }}
            >
              APP-{appointment.id.substring(0, 8).toUpperCase()}
            </span>
            <span style={{ color: '#0369a1', fontWeight: 600 }}>Active Session</span>
          </div>

          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#0c4a6e',
              fontWeight: 500,
              fontSize: '0.78rem',
            }}
          >
            <Clock size={13} style={{ color: '#0284c7' }} />
            {appointment.scheduled_time || `${appointment.date || ''}`}
          </span>
        </div>

        {/* ── Chat Messages Body ── */}
        <div
          style={{
            flex: 1,
            padding: '20px 22px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
          }}
        >
          {/* Day Divider */}
          <div style={{ textAlign: 'center', margin: '4px 0 10px 0' }}>
            <span
              style={{
                fontSize: '0.72rem',
                color: '#94a3b8',
                fontWeight: 600,
                backgroundColor: '#ffffff',
                padding: '4px 14px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Today's Consultation Desk Chat
            </span>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', color: '#64748b', marginTop: '60px', fontSize: '0.88rem' }}>
              <Loader2 size={26} className="spin" style={{ margin: '0 auto 10px', color: '#0ea5e9', display: 'block' }} />
              Loading encrypted medical chat...
            </div>
          ) : messages.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                margin: 'auto 0',
                padding: '36px 24px',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px dashed #cbd5e1',
                boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#e0f2fe',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}
              >
                <MessageSquare size={26} />
              </div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
                Direct Messaging Initialized
              </h4>
              <p style={{ margin: 0, fontSize: '0.83rem', color: '#64748b', lineHeight: 1.5 }}>
                Send your queries, symptom updates, or diagnostic report notifications directly to Dr. {doctorName.replace('Dr. ', '')}.
              </p>
            </div>
          ) : (
            messages.map((msg: any) => {
              const isMe = msg.sender_id === currentUserId || msg.sender_role === 'patient';
              const formattedTime = new Date(msg.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                  }}
                >
                  {/* Sender Name Header */}
                  <div
                    style={{
                      fontSize: '0.73rem',
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
                    {!isMe && <Sparkles size={11} style={{ color: '#0d9488' }} />}
                    {isMe ? 'You' : msg.sender_name || doctorName}
                  </div>

                  {/* Message Bubble */}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isMe
                        ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'
                        : '#ffffff',
                      color: isMe ? '#ffffff' : '#0f172a',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                      boxShadow: isMe
                        ? '0 4px 14px rgba(14, 165, 233, 0.25)'
                        : '0 4px 14px rgba(0, 0, 0, 0.05)',
                      border: isMe ? 'none' : '1px solid #e2e8f0',
                      wordBreak: 'break-word',
                      fontWeight: isMe ? 500 : 500,
                    }}
                  >
                    {msg.message_text}
                  </div>

                  {/* Timestamp & Read Indicator */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.68rem',
                      color: '#94a3b8',
                      marginTop: '4px',
                      paddingLeft: isMe ? 0 : '4px',
                      paddingRight: isMe ? '4px' : 0,
                    }}
                  >
                    <Clock size={10} />
                    <span>{formattedTime}</span>
                    {isMe && <CheckCheck size={13} color={msg.is_read ? '#0284c7' : '#94a3b8'} />}
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* ── Quick Suggestions Bar ── */}
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(undefined, p.text)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '20px',
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                color: '#0369a1',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e0f2fe';
                e.currentTarget.style.borderColor = '#7dd3fc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f9ff';
                e.currentTarget.style.borderColor = '#bae6fd';
              }}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>

        {/* ── Executive Input Bar Footer ── */}
        <form
          onSubmit={handleSendMessage}
          style={{
            padding: '14px 18px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            boxShadow: '0 -4px 15px rgba(0,0,0,0.03)',
          }}
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your query to clinic support..."
            style={{
              flex: 1,
              padding: '12px 18px',
              borderRadius: '28px',
              border: '1.5px solid #cbd5e1',
              fontSize: '0.9rem',
              outline: 'none',
              backgroundColor: '#f8fafc',
              color: '#0f172a',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#0ea5e9';
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14, 165, 233, 0.15)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.backgroundColor = '#f8fafc';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: !inputText.trim() || isSending
                ? '#cbd5e1'
                : 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
              color: '#ffffff',
              border: 'none',
              cursor: !inputText.trim() || isSending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              flexShrink: 0,
              boxShadow: !inputText.trim() || isSending ? 'none' : '0 4px 14px rgba(14, 165, 233, 0.4)',
            }}
          >
            {isSending ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
};
