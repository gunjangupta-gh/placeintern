import React from 'react';

const StarRating = ({ rating = 0, maxStars = 5 }) => (
  <div className="flex" role="img" aria-label={`Rating: ${rating} out of ${maxStars} stars`}>
    {Array.from({ length: maxStars }, (_, i) => (
      <span
        key={i}
        className={`text-lg ${
          i < rating ? 'text-yellow-400' : 'text-gray-300'
        }`}
        aria-hidden="true"
      >
        ★
      </span>
    ))}
  </div>
);

export default StarRating;
