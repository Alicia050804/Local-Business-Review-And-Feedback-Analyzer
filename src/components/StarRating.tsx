import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
}

export function StarRating({ rating, size = 'sm' }: StarRatingProps) {
  const rounded = Math.round(rating);
  const iconSize = size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          className={`${iconSize} ${
            index <= rounded ? 'fill-mango text-mango' : 'fill-stone-200 text-stone-200'
          }`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
