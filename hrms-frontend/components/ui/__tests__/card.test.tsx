import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card';

describe('Card', () => {
  it('renders with children', () => {
    render(<Card><p>Card content</p></Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies hover class when hover prop is true', () => {
    const { rerender } = render(<Card hover>Hover card</Card>);
    expect(screen.getByText('Hover card').className).toContain('card-hover');

    rerender(<Card>Normal card</Card>);
    expect(screen.getByText('Normal card').className).not.toContain('card-hover');
  });

  it('applies glass class when glass prop is true', () => {
    render(<Card glass>Glass card</Card>);
    expect(screen.getByText('Glass card').className).toContain('glass');
  });

  it('renders card header with title and description', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description text</CardDescription>
        </CardHeader>
      </Card>
    );
    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Card description text')).toBeInTheDocument();
  });

  it('renders card content', () => {
    render(
      <Card>
        <CardContent>Content area</CardContent>
      </Card>
    );
    expect(screen.getByText('Content area')).toBeInTheDocument();
  });

  it('renders card footer', () => {
    render(
      <Card>
        <CardFooter>Footer area</CardFooter>
      </Card>
    );
    expect(screen.getByText('Footer area')).toBeInTheDocument();
  });
});
