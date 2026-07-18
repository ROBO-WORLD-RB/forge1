import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SimpleMarkdown } from './simpleMarkdown';

describe('SimpleMarkdown', () => {
  it('renders bold and italic without raw markers', () => {
    render(<SimpleMarkdown text="Try **bold** and *italic* text" />);
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('italic').tagName).toBe('EM');
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  it('renders bullet lists', () => {
    render(<SimpleMarkdown text={'- One\n- Two'} />);
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
    expect(document.querySelector('ul')).toBeTruthy();
  });

  it('does not interpret HTML tags as markup', () => {
    render(<SimpleMarkdown text={'Hello <script>alert(1)</script>'} />);
    expect(screen.getByText(/Hello <script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });
});
