import { useState } from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ value = 0, onChange, size = 20, readonly = false }) {
    const [hovered, setHovered] = useState(0);

    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    onClick={() => !readonly && onChange?.(star)}
                    onMouseEnter={() => !readonly && setHovered(star)}
                    onMouseLeave={() => !readonly && setHovered(0)}
                    disabled={readonly}
                    className="transition-transform duration-150 hover:scale-125 disabled:cursor-default"
                    style={{ background: 'none', border: 'none', padding: 2 }}
                >
                    <Star
                        size={size}
                        fill={(hovered || value) >= star ? '#f59e0b' : 'transparent'}
                        color={(hovered || value) >= star ? '#f59e0b' : '#64748b'}
                        strokeWidth={1.5}
                    />
                </button>
            ))}
        </div>
    );
}
