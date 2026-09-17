import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Register } from '../Register';

describe('<Register /> Cascading Location Dropdowns', () => {
  it('renders fixed country India and populates districts dynamically when a state is selected', () => {
    render(
      <MemoryRouter initialEntries={['/roadways/register']}>
        <Routes>
          <Route path="/:mode/register" element={<Register />} />
        </Routes>
      </MemoryRouter>,
    );

    // Country should be fixed to India
    const countrySelect = screen.getByLabelText(/country/i);
    expect(countrySelect).toHaveValue('India');
    expect(countrySelect).toBeDisabled();

    // District select should initially be disabled
    const districtSelect = screen.getByLabelText(/district/i);
    expect(districtSelect).toBeDisabled();

    // Select State: Maharashtra
    const stateSelect = screen.getByLabelText(/state \/ ut/i);
    fireEvent.change(stateSelect, { target: { value: 'Maharashtra' } });

    // District select should now be enabled and contain Maharashtra districts
    expect(districtSelect).not.toBeDisabled();
    expect(screen.getByText('Mumbai City')).toBeInTheDocument();
    expect(screen.getByText('Pune')).toBeInTheDocument();

    // Change State to Karnataka
    fireEvent.change(stateSelect, { target: { value: 'Karnataka' } });
    expect(screen.getByText('Bengaluru Urban')).toBeInTheDocument();
    expect(screen.queryByText('Mumbai City')).not.toBeInTheDocument();
  });
});
