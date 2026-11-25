import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface AddBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBusiness: (input: { name: string; category: string; description: string }) => void;
}

const CATEGORIES = [
  'Kotas & Chips',
  'Fresh Produce & Traditional Meals',
  'Cold Drinks & Refreshments',
  'Bakery & Street Food',
  'Shisa Nyama & Grill',
];

export function AddBusinessModal({ isOpen, onClose, onAddBusiness }: AddBusinessModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    if (!trimmedName || !trimmedDesc) return;

    onAddBusiness({
      name: trimmedName,
      category,
      description: trimmedDesc,
    });

    setName('');
    setCategory(CATEGORIES[0]);
    setDescription('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-business-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-stone-200 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 id="add-business-title" className="font-display text-xl font-bold text-charcoal">
            Add Local Business
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="biz-name" className="block text-sm font-semibold text-charcoal mb-1.5">
              Business Name
            </label>
            <input
              id="biz-name"
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Mama Joy's Fresh Corner"
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-mango focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="biz-category" className="block text-sm font-semibold text-charcoal mb-1.5">
              Category
            </label>
            <select
              id="biz-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-mango focus:border-transparent"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="biz-desc" className="block text-sm font-semibold text-charcoal mb-1.5">
              Description
            </label>
            <textarea
              id="biz-desc"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell neighbors what makes this spot special..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-mango focus:border-transparent"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-sm font-semibold text-stone-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-limefresh hover:bg-emerald-700 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Save Business
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
