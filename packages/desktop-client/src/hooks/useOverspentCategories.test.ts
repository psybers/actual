import { act, renderHook } from '@testing-library/react-hooks';

import * as monthUtils from 'loot-core/shared/months';

import { useCategories } from '@desktop-client/hooks/useCategories';
import { useSpreadsheet } from '@desktop-client/hooks/useSpreadsheet';
import { useSyncedPref } from '@desktop-client/hooks/useSyncedPref';

import { useOverspentCategories } from './useOverspentCategories';

// Mocks
jest.mock('@desktop-client/hooks/useSpreadsheet');
jest.mock('@desktop-client/hooks/useSyncedPref');
jest.mock('@desktop-client/hooks/useCategories');

const mockUseSpreadsheet = useSpreadsheet as jest.MockedFunction<
  typeof useSpreadsheet
>;
const mockUseSyncedPref = useSyncedPref as jest.MockedFunction<
  typeof useSyncedPref
>;
const mockUseCategories = useCategories as jest.MockedFunction<
  typeof useCategories
>;

const mockSpreadsheet = {
  bind: jest.fn(),
};

describe('useOverspentCategories Hook', () => {
  let month: string;

  beforeEach(() => {
    month = monthUtils.currentMonth();
    mockUseSpreadsheet.mockReturnValue(mockSpreadsheet as any);
    mockSpreadsheet.bind.mockImplementation((sheetName, binding, callback) => {
      // Default behavior: balance is 0, carryover is false
      if (binding.name === 'balance') {
        callback({ value: 0 });
      } else if (binding.name === 'carryover') {
        callback({ value: false });
      }
      return () => {}; // Return an unbind function
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return an empty array when no categories are overspent', () => {
    mockUseSyncedPref.mockReturnValue(['envelope', jest.fn()]);
    mockUseCategories.mockReturnValue({
      list: [
        { id: 'cat1', name: 'Category 1', hidden: false, is_income: false },
        { id: 'cat2', name: 'Category 2', hidden: false, is_income: false },
      ],
      grouped: [],
      map: new Map(),
    });

    const { result } = renderHook(() => useOverspentCategories({ month }));
    expect(result.current).toEqual([]);
  });

  it('should identify overspent categories (balance < 0, no carryover)', () => {
    mockUseSyncedPref.mockReturnValue(['envelope', jest.fn()]);
    mockUseCategories.mockReturnValue({
      list: [
        { id: 'cat1', name: 'Not Overspent', hidden: false, is_income: false },
        { id: 'cat2', name: 'Overspent', hidden: false, is_income: false },
        { id: 'cat3', name: 'Overspent with Carryover', hidden: false, is_income: false },
      ],
      grouped: [],
      map: new Map(),
    });

    mockSpreadsheet.bind.mockImplementation((sheetName, binding, callback) => {
      if (binding.name === 'balance' && binding.args[0] === 'cat1') {
        callback({ value: 100 }); // Not overspent
      } else if (binding.name === 'balance' && binding.args[0] === 'cat2') {
        callback({ value: -50 }); // Overspent
      } else if (binding.name === 'balance' && binding.args[0] === 'cat3') {
        callback({ value: -20 }); // Overspent
      }

      if (binding.name === 'carryover' && binding.args[0] === 'cat1') {
        callback({ value: false });
      } else if (binding.name === 'carryover' && binding.args[0] === 'cat2') {
        callback({ value: false }); // No carryover
      } else if (binding.name === 'carryover' && binding.args[0] === 'cat3') {
        callback({ value: true }); // With carryover
      }
      return () => {};
    });

    const { result } = renderHook(() => useOverspentCategories({ month }));

    act(() => {
      // Simulate spreadsheet updates if necessary, though direct calls should trigger effects
    });

    expect(result.current.length).toBe(1);
    expect(result.current[0].id).toBe('cat2');
  });

  describe('Tracking Budget Filtering', () => {
    const categories = [
      { id: 'cat1', name: 'Visible Expense', hidden: false, is_income: false, group: 'group1' },
      { id: 'cat2', name: 'Hidden Expense', hidden: true, is_income: false, group: 'group1' },
      { id: 'cat3', name: 'Visible Income', hidden: false, is_income: true, group: 'group2' },
      { id: 'cat4', name: 'Hidden Income', hidden: true, is_income: true, group: 'group2' },
      { id: 'cat5', name: 'Another Visible Expense', hidden: false, is_income: false, group: 'group1' },
    ];

    beforeEach(() => {
      mockUseSyncedPref.mockReturnValue(['tracking', jest.fn()]);
      mockUseCategories.mockReturnValue({
        list: categories,
        grouped: [],
        map: new Map(categories.map(c => [c.id, c])),
      });
    });

    it('should filter out hidden categories when budgetType is "tracking"', () => {
      mockSpreadsheet.bind.mockImplementation((sheetName, binding, callback) => {
        // Make cat1 and cat2 overspent, cat5 not overspent
        if (binding.name === 'balance') {
          if (binding.args[0] === 'cat1') callback({ value: -10 }); // Visible Expense, Overspent
          if (binding.args[0] === 'cat2') callback({ value: -20 }); // Hidden Expense, Overspent
          if (binding.args[0] === 'cat5') callback({ value: 50 });  // Visible Expense, Not Overspent
        }
        if (binding.name === 'carryover') { // No carryover for any
             callback({ value: false });
        }
        return () => {};
      });

      const { result } = renderHook(() => useOverspentCategories({ month }));
      act(() => {});

      expect(result.current.length).toBe(1);
      expect(result.current.find(c => c.id === 'cat1')).toBeDefined();
      expect(result.current.find(c => c.id === 'cat2')).toBeUndefined(); // Should be filtered
    });

    it('should filter out income categories when budgetType is "tracking"', () => {
      mockSpreadsheet.bind.mockImplementation((sheetName, binding, callback) => {
        // Make cat1 and cat3 overspent
        if (binding.name === 'balance') {
          if (binding.args[0] === 'cat1') callback({ value: -10 }); // Visible Expense, Overspent
          if (binding.args[0] === 'cat3') callback({ value: -30 }); // Visible Income, Overspent
        }
         if (binding.name === 'carryover') { // No carryover for any
             callback({ value: false });
        }
        return () => {};
      });

      const { result } = renderHook(() => useOverspentCategories({ month }));
      act(() => {});

      expect(result.current.length).toBe(1);
      expect(result.current.find(c => c.id === 'cat1')).toBeDefined();
      expect(result.current.find(c => c.id === 'cat3')).toBeUndefined(); // Should be filtered
    });

    it('should filter out both hidden and income categories when budgetType is "tracking"', () => {
        mockSpreadsheet.bind.mockImplementation((sheetName, binding, callback) => {
        if (binding.name === 'balance') {
          if (binding.args[0] === 'cat1') callback({ value: -10 }); // Visible Expense, Overspent
          if (binding.args[0] === 'cat2') callback({ value: -20 }); // Hidden Expense, Overspent
          if (binding.args[0] === 'cat3') callback({ value: -30 }); // Visible Income, Overspent
          if (binding.args[0] === 'cat4') callback({ value: -40 }); // Hidden Income, Overspent
          if (binding.args[0] === 'cat5') callback({ value: -50 }); // Another Visible Expense, Overspent
        }
         if (binding.name === 'carryover') { // No carryover for any
             callback({ value: false });
        }
        return () => {};
      });

      const { result } = renderHook(() => useOverspentCategories({ month }));
      act(() => {});
      
      expect(result.current.length).toBe(2);
      expect(result.current.find(c => c.id === 'cat1')).toBeDefined();
      expect(result.current.find(c => c.id === 'cat5')).toBeDefined();
      expect(result.current.find(c => c.id === 'cat2')).toBeUndefined(); // Hidden
      expect(result.current.find(c => c.id === 'cat3')).toBeUndefined(); // Income
      expect(result.current.find(c => c.id === 'cat4')).toBeUndefined(); // Hidden & Income
    });
  });

  describe('Envelope Budget (No Filtering)', () => {
    const categories = [
      { id: 'cat1', name: 'Visible Expense', hidden: false, is_income: false, group: 'group1' },
      { id: 'cat2', name: 'Hidden Expense', hidden: true, is_income: false, group: 'group1' },
      { id: 'cat3', name: 'Visible Income', hidden: false, is_income: true, group: 'group2' },
      { id: 'cat4', name: 'Hidden Income', hidden: true, is_income: true, group: 'group2' },
      { id: 'cat5', name: 'Another Visible Expense', hidden: false, is_income: false, group: 'group1' },
    ];

    beforeEach(() => {
      mockUseSyncedPref.mockReturnValue(['envelope', jest.fn()]);
      mockUseCategories.mockReturnValue({
        list: categories,
        grouped: [],
        map: new Map(categories.map(c => [c.id, c])),
      });
    });

    it('should NOT filter hidden or income categories when budgetType is "envelope"', () => {
      mockSpreadsheet.bind.mockImplementation((sheetName, binding, callback) => {
        // Make all categories overspent
        if (binding.name === 'balance') {
          if (binding.args[0] === 'cat1') callback({ value: -10 });
          if (binding.args[0] === 'cat2') callback({ value: -20 }); // Hidden
          if (binding.args[0] === 'cat3') callback({ value: -30 }); // Income
          if (binding.args[0] === 'cat4') callback({ value: -40 }); // Hidden & Income
          if (binding.args[0] === 'cat5') callback({ value: -50 });
        }
        if (binding.name === 'carryover') { // No carryover for any
             callback({ value: false });
        }
        return () => {};
      });

      const { result } = renderHook(() => useOverspentCategories({ month }));
      act(() => {});

      expect(result.current.length).toBe(5);
      expect(result.current.find(c => c.id === 'cat1')).toBeDefined();
      expect(result.current.find(c => c.id === 'cat2')).toBeDefined(); // Hidden, should be present
      expect(result.current.find(c => c.id === 'cat3')).toBeDefined(); // Income, should be present
      expect(result.current.find(c => c.id === 'cat4')).toBeDefined(); // Hidden & Income, should be present
      expect(result.current.find(c => c.id === 'cat5')).toBeDefined();
    });
  });
});
