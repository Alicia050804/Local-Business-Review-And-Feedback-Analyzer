import { useState } from 'react';
import { Store, UtensilsCrossed, Leaf, CupSoda } from 'lucide-react';

interface BusinessMediaProps {
  imageUrl?: string;
  name: string;
  category: string;
  className?: string;
}

export function BusinessMedia({ imageUrl, name, category, className = '' }: BusinessMediaProps) {
  const [hasError, setHasError] = useState(false);

  const IconComponent = category.toLowerCase().includes('produce')
    ? Leaf
    : category.toLowerCase().includes('drink')
      ? CupSoda
      : category.toLowerCase().includes('kota') || category.toLowerCase().includes('grill')
        ? UtensilsCrossed
        : Store;

  if (!imageUrl || hasError) {
    return (
      <div
        className={`w-full h-full bg-gradient-to-br from-orange-50 via-lemonade to-emerald-50 flex flex-col items-center justify-center p-6 text-center ${className}`}
      >
        <div className="w-12 h-12 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-mango mb-2.5">
          <IconComponent className="w-6 h-6" aria-hidden="true" />
        </div>
        <span className="font-display font-semibold text-sm text-charcoal line-clamp-1">
          {name}
        </span>
        <span className="text-xs text-stone-500 mt-0.5">{category}</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={`${name} — ${category}`}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`w-full h-full object-cover ${className}`}
    />
  );
}
