import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  X, Send, Phone, MessageSquare, Loader2, 
  User, CheckCheck, Clock 
} from 'lucide-react';

function formatMessageTime(timestamp) {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return 'Just now';
}

export default function BookingChatModal({ booking, currentUser, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const currentUid = currentUser?.uid || currentUser?.id;
  const isCurrentUserCustomer = currentUid === booking?.customerId;
  
  const otherPartyName = isCurrentUserCustomer 
    ? (booking?.providerName || 'Service Provider')
    : (booking?.customerName || 'Customer');

  const otherPartyPhone = isCurrentUserCustomer
    ? (booking?.providerPhone || '')
    : (booking?.customerPhone || '');

  const otherPartySubtitle = isCurrentUserCustomer
    ? (booking?.serviceCategory || 'Specialist')
    : 'Customer Client';

  // 1. FIRESTORE onSnapshot: Listen to subcollection bookings/{bookingId}/messages ordered by createdAt asc
  useEffect(() => {
    if (!booking?.id) return;

    setLoading(true);
    let unsubscribe;

    try {
      const messagesRef = collection(db, 'bookings', booking.id, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'asc'));

      unsubscribe = onSnapshot(q, (snapshot) => {
        const messageList = [];
        snapshot.forEach((doc) => {
          messageList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setMessages(messageList);
        setLoading(false);
      }, (error) => {
        console.error('Real-time chat listener error:', error);
        setLoading(false);
      });
    } catch (err) {
      console.error('Failed to attach chat listener:', err);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [booking?.id]);

  // 2. AUTO-SCROLL TO NEWEST MESSAGE
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 3. SEND MESSAGE HANDLER
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);

    try {
      const messagesRef = collection(db, 'bookings', booking.id, 'messages');
      await addDoc(messagesRef, {
        text: trimmed,
        senderId: currentUid,
        senderName: currentUser?.name || (isCurrentUserCustomer ? 'Customer' : 'Provider'),
        createdAt: serverTimestamp(),
      });
      setText('');
    } catch (err) {
      console.error('Failed to write message to Firestore:', err);
      alert('Could not send message: ' + err.message);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg h-[600px] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
        
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white font-black flex items-center justify-center text-sm shadow-xs shrink-0">
              {otherPartyName.slice(0, 2).toUpperCase()}
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-white truncate leading-tight">
                  {otherPartyName}
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                  Live
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate mt-0.5">
                {otherPartySubtitle} • Booking #{booking?.id?.slice(0, 6)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Quick Call Button in Chat Header */}
            {otherPartyPhone && (
              <a
                href={`tel:${otherPartyPhone}`}
                title={`Call ${otherPartyName} (${otherPartyPhone})`}
                className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-xl transition shadow-xs flex items-center justify-center cursor-pointer"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}

            {/* Close Modal Button */}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* CHAT MESSAGES SCROLLABLE CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-2.5">
              <Loader2 className="h-7 w-7 text-blue-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Connecting to real-time chat...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Start the conversation</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Send a message to coordinate service timing, address details, or specific job instructions.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === currentUid;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} space-y-1`}
                >
                  {/* Sender Name label */}
                  <span className="text-[10px] font-semibold text-slate-400 px-1">
                    {isMine ? 'You' : msg.senderName || otherPartyName}
                  </span>

                  {/* Message Bubble: Right = Blue, Left = Slate */}
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 shadow-2xs text-xs sm:text-sm leading-relaxed ${
                      isMine
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    <div
                      className={`flex items-center justify-end space-x-1 mt-1 text-[10px] ${
                        isMine ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      <Clock className="h-2.5 w-2.5" />
                      <span>{formatMessageTime(msg.createdAt)}</span>
                      {isMine && <CheckCheck className="h-3 w-3 ml-0.5 text-blue-200" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT & SEND FORM */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Message ${otherPartyName}...`}
              className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-800 placeholder:text-slate-400"
            />
            
            <button
              type="submit"
              disabled={isSending || !text.trim()}
              className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 text-white p-2.5 sm:px-4 sm:py-2.5 rounded-2xl transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer font-bold text-xs"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
