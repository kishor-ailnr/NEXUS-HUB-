import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Hub } from '../Hub';
import { platformService } from '../../services/platform';

vi.mock('../../services/platform', () => ({
  platformService: {
    getHubStats: vi.fn(),
  },
}));

describe('<Hub /> Page (Phase 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders four mode cards and loads real active transit stats from platformService.getHubStats', async () => {
    vi.mocked(platformService.getHubStats).mockResolvedValueOnce({
      roadways: { activeMovements: 14 },
      railways: { activeMovements: 6 },
      airways: { activeMovements: 9 },
      seaways: { activeMovements: 4 },
    });

    render(
      <MemoryRouter>
        <Hub />
      </MemoryRouter>
    );

    // Verify Title and Subtitles
    expect(screen.getAllByText('NEXUS WAYS').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Across Every Mode of Transport/i)).toBeInTheDocument();
    expect(screen.getByText(/Welcome to/i)).toBeInTheDocument();

    // Verify 4 mode cards in order
    const roadwaysCard = screen.getByTestId('mode-card-roadways');
    const railwaysCard = screen.getByTestId('mode-card-railways');
    const airwaysCard = screen.getByTestId('mode-card-airways');
    const seawaysCard = screen.getByTestId('mode-card-seaways');

    expect(roadwaysCard).toBeInTheDocument();
    expect(railwaysCard).toBeInTheDocument();
    expect(airwaysCard).toBeInTheDocument();
    expect(seawaysCard).toBeInTheDocument();

    // Check href links
    expect(roadwaysCard).toHaveAttribute('href', '/roadways/login');
    expect(railwaysCard).toHaveAttribute('href', '/railways/login');
    expect(airwaysCard).toHaveAttribute('href', '/airways/login');
    expect(seawaysCard).toHaveAttribute('href', '/seaways/login');

    // Check titles
    expect(screen.getByText('Roadways')).toBeInTheDocument();
    expect(screen.getByText('Railways')).toBeInTheDocument();
    expect(screen.getByText('Airways')).toBeInTheDocument();
    expect(screen.getByText('Seaways')).toBeInTheDocument();

    // Wait for real stats to load
    await waitFor(() => {
      expect(screen.getByTestId('stat-roadways')).toHaveTextContent('14');
      expect(screen.getByTestId('stat-railways')).toHaveTextContent('6');
      expect(screen.getByTestId('stat-airways')).toHaveTextContent('9');
      expect(screen.getByTestId('stat-seaways')).toHaveTextContent('4');
    });

    const inTransitLabels = screen.getAllByText(/in-transit/i);
    expect(inTransitLabels.length).toBe(4);
  });

  it('handles platformService error gracefully with 0 fallback', async () => {
    vi.mocked(platformService.getHubStats).mockRejectedValueOnce(new Error('Network error'));

    render(
      <MemoryRouter>
        <Hub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('stat-roadways')).toHaveTextContent('0');
      expect(screen.getByTestId('stat-railways')).toHaveTextContent('0');
      expect(screen.getByTestId('stat-airways')).toHaveTextContent('0');
      expect(screen.getByTestId('stat-seaways')).toHaveTextContent('0');
    });
  });
});
