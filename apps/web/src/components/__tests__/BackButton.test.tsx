import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BackButton } from '../BackButton';

const mockedNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

describe('<BackButton />', () => {
  it('renders the Back button with label and icon', () => {
    render(
      <MemoryRouter>
        <BackButton />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: /go back/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('navigates backwards when clicked', () => {
    render(
      <MemoryRouter>
        <BackButton fallbackTo="/" />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: /go back/i });
    fireEvent.click(button);
    expect(mockedNavigate).toHaveBeenCalled();
  });
});
