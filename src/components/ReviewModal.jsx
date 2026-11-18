import React, { useState } from 'react';
import { Star, X, Loader2, CheckCircle2, MessageSquare, Sparkles } from 'lucide-react';

const RATING_LABELS = {
  1: '1 Star - Poor Experience',
  2: '2 Stars - Below Expectations',
  3: '3 Stars - Satisfactory Service',
  4: '4 Stars - Great Work & Friendly',
  5: '5 Stars - Outstanding & Highly Recommended! 🌟'
};

export default function ReviewModal({ booking, onSubmitReview, onClose, isSubmitting = false }) {
  const [selectedStars, setSelectedStars] = useState(5);
  const [hoverStars, setHoverStars] = useState(0);
  const [reviewText, setReviewText] = useState('');

  const currentDisplayStars = hoverStars || selectedStars;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmitReview) {
      onSubmitReview({
        rating: selectedStars,
        reviewText: reviewText.trim()
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-[95%] max-w-md max-h-[85vh] overflow-y-auto mx-auto z-50 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
        
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white flex justify-between items-start">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider mb-1.5">
              <Sparkles className="h-3 w-3" />
              <span>Service Completed</span>
            </div>
            <h2 className="text-xl font-extrabold leading-tight">
              Rate {booking?.providerName || 'Specialist'}
            </h2>
            <p className="text-xs text-amber-100 mt-0.5">
              {booking?.serviceCategory} • Booking #{booking?.id?.slice(0, 6)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-amber-100 hover:text-white p-1 rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* INTERACTIVE 1-5 STAR SELECTOR */}
          <div className="text-center space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              How would you rate the service?
            </label>

            {/* Stars Row */}
            <div className="flex items-center justify-center space-x-2 py-1">
              {[1, 2, 3, 4, 5].map((starIndex) => {
                const isFilled = starIndex <= currentDisplayStars;

                return (
                  <button
                    key={starIndex}
                    type="button"
                    onClick={() => setSelectedStars(starIndex)}
                    onMouseEnter={() => setHoverStars(starIndex)}
                    onMouseLeave={() => setHoverStars(0)}
                    className="p-1 rounded-xl hover:scale-125 transition-transform duration-150 cursor-pointer focus:outline-none"
                    aria-label={`${starIndex} Star`}
                  >
                    <Star
                      className={`h-9 w-9 transition-colors ${
                        isFilled
                          ? 'fill-amber-400 text-amber-400 filter drop-shadow-sm'
                          : 'fill-transparent text-slate-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Rating Label Text */}
            <p className="text-xs font-bold text-amber-700 h-5">
              {RATING_LABELS[currentDisplayStars]}
            </p>
          </div>

          {/* OPTIONAL COMMENT TEXT BOX */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Write a Review <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <div className="relative">
              <textarea
                rows={3}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your experience (e.g. punctuality, quality of work, professional demeanor)..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition resize-none placeholder:text-slate-400 text-slate-800"
              />
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-600 active:scale-[0.99] disabled:opacity-75 text-white font-extrabold py-2.5 px-4 rounded-xl transition shadow-lg shadow-amber-500/25 flex items-center justify-center space-x-2 text-sm cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting Review...</span>
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 fill-current" />
                  <span>Submit Review</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
