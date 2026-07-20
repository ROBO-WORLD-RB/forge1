import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'section' | 'article';
  padded?: boolean;
}

/**
 * Interaction/content container for OS surfaces.
 * Use only when a bordered surface aids understanding — not decorative chrome.
 */
const Card: React.FC<CardProps> = ({
  as: Tag = 'div',
  padded = true,
  className = '',
  children,
  ...props
}) => (
  <Tag
    className={`bg-white rounded-xl shadow-sm border border-gray-100 ${padded ? 'p-5' : ''} ${className}`}
    {...props}
  >
    {children}
  </Tag>
);

export default Card;
