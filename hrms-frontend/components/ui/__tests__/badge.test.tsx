import { render, screen } from '@testing-library/react';
import { Badge, statusTone } from '../badge';

describe('Badge', () => {
  it('renders with text content', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { rerender } = render(<Badge variant="success">Success</Badge>);
    expect(screen.getByText('Success').className).toContain('bg-accent-soft');

    rerender(<Badge variant="warning">Warning</Badge>);
    expect(screen.getByText('Warning').className).toContain('bg-amber-soft');
  });

  it('maps tone prop to correct variant', () => {
    const { rerender } = render(<Badge tone="success">Active</Badge>);
    expect(screen.getByText('Active').className).toContain('bg-accent-soft');

    rerender(<Badge tone="danger">Absent</Badge>);
    expect(screen.getByText('Absent').className).toContain('bg-danger');
  });

  it('renders with custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>);
    expect(screen.getByText('Custom').className).toContain('custom-class');
  });
});

describe('statusTone', () => {
  it('returns success for positive statuses', () => {
    expect(statusTone('ACTIVE')).toBe('success');
    expect(statusTone('APPROVED')).toBe('success');
    expect(statusTone('PRESENT')).toBe('success');
  });

  it('returns danger for negative statuses', () => {
    expect(statusTone('REJECTED')).toBe('danger');
    expect(statusTone('ABSENT')).toBe('danger');
    expect(statusTone('CANCELLED')).toBe('danger');
  });

  it('returns warning for pending statuses', () => {
    expect(statusTone('PENDING')).toBe('warning');
    expect(statusTone('LATE')).toBe('warning');
    expect(statusTone('HALF_DAY')).toBe('warning');
  });

  it('returns default for unknown statuses', () => {
    expect(statusTone('UNKNOWN')).toBe('default');
    expect(statusTone('CUSTOM_STATUS')).toBe('default');
  });
});
