import { type Page } from '@playwright/test';

import * as monthUtils from 'loot-core/shared/months';
import { amountToCurrency, currencyToAmount } from 'loot-core/shared/util';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { type MobileBudgetPage } from './page-models/mobile-budget-page';
import { MobileNavigation } from './page-models/mobile-navigation';

const copyLastMonthBudget = async (
  budgetPage: MobileBudgetPage,
  categoryName: string,
) => {
  const budgetMenuModal = await budgetPage.openBudgetMenu(categoryName);
  await budgetMenuModal.copyLastMonthBudget();
  await budgetMenuModal.close();
};

const setTo3MonthAverage = async (
  budgetPage: MobileBudgetPage,
  categoryName: string,
) => {
  const budgetMenuModal = await budgetPage.openBudgetMenu(categoryName);
  await budgetMenuModal.setTo3MonthAverage();
  await budgetMenuModal.close();
};

const setTo6MonthAverage = async (
  budgetPage: MobileBudgetPage,
  categoryName: string,
) => {
  const budgetMenuModal = await budgetPage.openBudgetMenu(categoryName);
  await budgetMenuModal.setTo6MonthAverage();
  await budgetMenuModal.close();
};

const setToYearlyAverage = async (
  budgetPage: MobileBudgetPage,
  categoryName: string,
) => {
  const budgetMenuModal = await budgetPage.openBudgetMenu(categoryName);
  await budgetMenuModal.setToYearlyAverage();
  await budgetMenuModal.close();
};

async function setBudgetAverage(
  budgetPage: MobileBudgetPage,
  categoryName: string,
  numberOfMonths: number,
  setBudgetAverageFn: (
    budgetPage: MobileBudgetPage,
    categoryName: string,
    numberOfMonths: number,
  ) => Promise<void>,
) {
  let totalSpent = 0;

  for (let i = 0; i < numberOfMonths; i++) {
    await budgetPage.goToPreviousMonth();
    const spentButton = await budgetPage.getButtonForSpent(categoryName);
    const spent = await spentButton.textContent();
    if (!spent) {
      throw new Error('Failed to get spent amount');
    }
    totalSpent += currencyToAmount(spent) ?? 0;
  }

  // Calculate average amount
  const averageSpent = totalSpent / numberOfMonths;

  // Go back to the current month
  for (let i = 0; i < numberOfMonths; i++) {
    await budgetPage.goToNextMonth();
  }

  await setBudgetAverageFn(budgetPage, categoryName, numberOfMonths);

  return averageSpent;
}

const budgetTypes = ['Envelope', 'Tracking'] as const;

budgetTypes.forEach(budgetType => {
  test.describe(`Mobile Budget [${budgetType}]`, () => {
    let page: Page;
    let navigation: MobileNavigation;
    let configurationPage: ConfigurationPage;
    let previousGlobalIsTesting: boolean;

    test.beforeAll(() => {
      // TODO: Hack, properly mock the currentMonth function
      previousGlobalIsTesting = global.IS_TESTING;
      global.IS_TESTING = true;
    });

    test.afterAll(() => {
      // TODO: Hack, properly mock the currentMonth function
      global.IS_TESTING = previousGlobalIsTesting;
    });

    test.beforeEach(async ({ browser }) => {
      page = await browser.newPage();
      navigation = new MobileNavigation(page);
      configurationPage = new ConfigurationPage(page);

      await page.setViewportSize({
        width: 350,
        height: 600,
      });
      await page.goto('/');
      await configurationPage.createTestFile();

      const settingsPage = await navigation.goToSettingsPage();
      await settingsPage.useBudgetType(budgetType);
    });

    test.afterEach(async () => {
      await page.close();
    });

    test('loads the budget page with budgeted amounts', async () => {
      const budgetPage = await navigation.goToBudgetPage();

      await expect(budgetPage.categoryNames).toHaveText([
        'Food',
        'Restaurants',
        'Entertainment',
        'Clothing',
        'General',
        'Gift',
        'Medical',
        'Savings',
        'Cell',
        'Internet',
        'Mortgage',
        'Water',
        'Power',
        'Starting Balances',
        'Misc',
        'Income',
      ]);
      await expect(page).toMatchThemeScreenshots();
    });

    // Page Header Tests

    test('checks that clicking the Actual logo in the page header opens the budget page menu', async () => {
      const budgetPage = await navigation.goToBudgetPage();

      await budgetPage.openBudgetPageMenu();

      const budgetPageMenuModal = page.getByRole('dialog');

      await expect(budgetPageMenuModal).toBeVisible();
      await expect(page).toMatchThemeScreenshots();
    });

    test("checks that clicking the left arrow in the page header shows the previous month's budget", async () => {
      const budgetPage = await navigation.goToBudgetPage();

      const selectedMonth = await budgetPage.getSelectedMonth();
      const displayMonth = monthUtils.format(
        selectedMonth,
        budgetPage.MONTH_HEADER_DATE_FORMAT,
      );

      await expect(budgetPage.heading).toHaveText(displayMonth);

      const previousMonth = await budgetPage.goToPreviousMonth();
      const previousDisplayMonth = monthUtils.format(
        previousMonth,
        budgetPage.MONTH_HEADER_DATE_FORMAT,
      );

      await expect(budgetPage.heading).toHaveText(previousDisplayMonth);
      await expect(page).toMatchThemeScreenshots();
    });

    test('checks that clicking the month in the page header opens the month menu modal', async () => {
      const budgetPage = await navigation.goToBudgetPage();

      const selectedMonth = await budgetPage.getSelectedMonth();

      await budgetPage.openMonthMenu();

      const monthMenuModal = page.getByRole('dialog');
      const monthMenuModalHeading = monthMenuModal.getByRole('heading');

      const displayMonth = monthUtils.format(
        selectedMonth,
        budgetPage.MONTH_HEADER_DATE_FORMAT,
      );
      await expect(monthMenuModalHeading).toHaveText(displayMonth);
      await expect(page).toMatchThemeScreenshots();
    });

    test("checks that clicking the right arrow in the page header shows the next month's budget", async () => {
      const budgetPage = await navigation.goToBudgetPage();

      const selectedMonth = await budgetPage.getSelectedMonth();
      const displayMonth = monthUtils.format(
        selectedMonth,
        budgetPage.MONTH_HEADER_DATE_FORMAT,
      );

      await expect(budgetPage.heading).toHaveText(displayMonth);

      const nextMonth = await budgetPage.goToNextMonth();
      const nextDisplayMonth = monthUtils.format(
        nextMonth,
        budgetPage.MONTH_HEADER_DATE_FORMAT,
      );

      await expect(budgetPage.heading).toHaveText(nextDisplayMonth);
      await expect(page).toMatchThemeScreenshots();
    });

    // Category / Category Group Menu Tests

    test('checks that clicking the category group name opens the category group menu modal', async () => {
      const budgetPage = await navigation.goToBudgetPage();

      const categoryGroupName = await budgetPage.getCategoryGroupNameForRow(0);
      await budgetPage.openCategoryGroupMenu(categoryGroupName);

      const categoryMenuModalHeading = page
        .getByRole('dialog')
        .getByRole('heading');

      await expect(categoryMenuModalHeading).toHaveText(categoryGroupName);
      await expect(page).toMatchThemeScreenshots();
    });

    test('checks that clicking the category name opens the category menu modal', async () => {
      const budgetPage = await navigation.goToBudgetPage();

      const categoryName = await budgetPage.getCategoryNameForRow(0);
      const categoryMenuModal = await budgetPage.openCategoryMenu(categoryName);

      await expect(categoryMenuModal.heading).toHaveText(categoryName);
      await expect(page).toMatchThemeScreenshots();
    });

    // Budgeted Cell Tests

    test('checks that clicking the budgeted cell opens the budget menu modal', async () => {
      const budgetPage = await navigation.goToBudgetPage();

      const categoryName = await budgetPage.getCategoryNameForRow(0);
      const budgetMenuModal = await budgetPage.openBudgetMenu(categoryName);

      await expect(budgetMenuModal.heading).toHaveText(categoryName);
      await expect(page).toMatchThemeScreenshots();
    });

    test('updates the budgeted amount', async () => {
      const budgetPage = await navigation.goToBudgetPage();

      const categoryName = await budgetPage.getCategoryNameForRow(0);
      const budgetMenuModal = await budgetPage.openBudgetMenu(categoryName);

      const budgetAmount = 123;

      // Set to 123.00
      await budgetMenuModal.setBudgetAmount(`${budgetAmount}00`);

      const budgetedButton =
        await budgetPage.getButtonForBudgeted(categoryName);

      await expect(budgetedButton).toHaveText(amountToCurrency(budgetAmount));
      await expect(page).toMatchThemeScreenshots();
    });

    test(`copies last month's budget`, async () => {
      const budgetPage = await navigation.goToBudgetPage();

      const categoryName = await budgetPage.getCategoryNameForRow(3);
      const budgetedButton =
        await budgetPage.getButtonForBudgeted(categoryName);

      await budgetPage.goToPreviousMonth();

      const lastMonthBudget = await budgetedButton.textContent();

      if (!lastMonthBudget) {
        throw new Error('Failed to get last month budget');
      }

      await budgetPage.goToNextMonth();

      await copyLastMonthBudget(budgetPage, categoryName);

      await expect(budgetedButton).toHaveText(lastMonthBudget);
      await expect(page).toMatchThemeScreenshots();
    });

    (
      [
        [3, setTo3MonthAverage],
        [6, setTo6MonthAverage],
        [12, setToYearlyAverage],
      ] as const
    ).forEach(([numberOfMonths, setBudgetAverageFn]) => {
      test(`set budget to ${numberOfMonths} month average`, async () => {
        const budgetPage = await navigation.goToBudgetPage();

        const categoryName = await budgetPage.getCategoryNameForRow(3);

        const averageSpent = await setBudgetAverage(
          budgetPage,
          categoryName,
          numberOfMonths,
          setBudgetAverageFn,
        );

        const budgetedButton =
          await budgetPage.getButtonForBudgeted(categoryName);

        await expect(budgetedButton).toHaveText(
          amountToCurrency(Math.abs(averageSpent)),
        );
        await expect(page).toMatchThemeScreenshots();
      });
    });

    test(`applies budget template`, async () => {
      const settingsPage = await navigation.goToSettingsPage();
      await settingsPage.enableExperimentalFeature('Goal templates');

      const budgetPage = await navigation.goToBudgetPage();

      const categoryName = await budgetPage.getCategoryNameForRow(1);

      const amountToTemplate = 123;

      const categoryMenuModal = await budgetPage.openCategoryMenu(categoryName);
      const editNotesModal = await categoryMenuModal.editNotes();
      const templateNotes = `#template ${amountToTemplate}`;
      await editNotesModal.updateNotes(templateNotes);
      await editNotesModal.close();

      const budgetedButton =
        await budgetPage.getButtonForBudgeted(categoryName);

      const budgetMenuModal = await budgetPage.openBudgetMenu(categoryName);
      await budgetMenuModal.applyBudgetTemplate();
      await budgetMenuModal.close();

      await expect(budgetedButton).toHaveText(
        amountToCurrency(amountToTemplate),
      );
      const notification = page.getByRole('alert').first();
      await expect(notification).toContainText(templateNotes);
      await expect(page).toMatchThemeScreenshots();
    });

    // Spent Cell Tests

    test('checks that clicking spent cell redirects to the category transactions page', async () => {
      const budgetPage = await navigation.goToBudgetPage();

      const categoryName = await budgetPage.getCategoryNameForRow(0);
      const accountPage = await budgetPage.openSpentPage(categoryName);

      await expect(accountPage.heading).toContainText(categoryName);
      await expect(accountPage.transactionList).toBeVisible();
      await expect(page).toMatchThemeScreenshots();
    });

    // Balance Cell Tests

    test('checks that clicking the balance cell opens the balance menu modal', async () => {
      const budgetPage = await navigation.goToBudgetPage();

      const categoryName = await budgetPage.getCategoryNameForRow(0);
      const balanceMenuModal = await budgetPage.openBalanceMenu(categoryName);

      await expect(balanceMenuModal.heading).toHaveText(categoryName);
      await expect(page).toMatchThemeScreenshots();
    });

    if (budgetType === 'Envelope') {
      test('checks that clicking the To Budget/Overbudgeted amount opens the budget summary menu modal', async () => {
        const budgetPage = await navigation.goToBudgetPage();

        const envelopeBudgetSummaryModal =
          await budgetPage.openEnvelopeBudgetSummary();

        await expect(envelopeBudgetSummaryModal.heading).toHaveText(
          'Budget Summary',
        );
        await expect(page).toMatchThemeScreenshots();
      });
    }

    if (budgetType === 'Tracking') {
      test('checks that clicking the Saved/Projected Savings/Overspent amount opens the budget summary menu modal', async () => {
        const budgetPage = await navigation.goToBudgetPage();

        const trackingBudgetSummaryModal =
          await budgetPage.openTrackingBudgetSummary();

        await expect(trackingBudgetSummaryModal.heading).toHaveText(
          'Budget Summary',
        );
        await expect(page).toMatchThemeScreenshots();
      });
    }

    if (budgetType === 'Tracking') {
      test.describe('Tracking Budget Overspending Banner', () => {
        const ACCOUNT_NAME = 'Checking';
        const VISIBLE_EXPENSE_CAT = 'Groceries';
        const HIDDEN_EXPENSE_CAT = 'Hidden Supplies';
        const VISIBLE_INCOME_CAT = 'Freelance Income';
        const NOT_OVERSPENT_CAT = 'Utilities';

        async function setupCategoriesAndTransactions() {
          // Create an account
          await page.evaluate(
            async ({ accountName }) => {
              const बजट = window.Actual.getBudgetAPI();
              await बजट.createAccount({
                name: accountName,
                balance: 0,
              });
            },
            { accountName: ACCOUNT_NAME },
          );
          const accountsPage = await navigation.goToAccountPage(ACCOUNT_NAME);
          await accountsPage.closeOnboardingMessages();

          // Create categories
          await page.evaluate(
            async ({ categories }) => {
              const बजट = window.Actual.getBudgetAPI();
              const existingGroups = await बजट.getCategoryGroups();
              let expenseGroupId = existingGroups.find(g => !g.is_income)?.id;
              if (!expenseGroupId) {
                expenseGroupId = await बजट.createCategoryGroup({
                  name: 'Expenses',
                  is_income: false,
                });
              }
              let incomeGroupId = existingGroups.find(g => g.is_income)?.id;
              if (!incomeGroupId) {
                incomeGroupId = await बजट.createCategoryGroup({
                  name: 'Income',
                  is_income: true,
                });
              }

              for (const cat of categories) {
                await बजट.createCategory({
                  name: cat.name,
                  group_id: cat.is_income ? incomeGroupId : expenseGroupId,
                  is_income: cat.is_income,
                  hidden: cat.hidden,
                });
              }
            },
            {
              categories: [
                { name: VISIBLE_EXPENSE_CAT, is_income: false, hidden: false },
                { name: HIDDEN_EXPENSE_CAT, is_income: false, hidden: true },
                { name: VISIBLE_INCOME_CAT, is_income: true, hidden: false },
                { name: NOT_OVERSPENT_CAT, is_income: false, hidden: false },
              ],
            },
          );

          // Add transactions to make categories overspent
          await page.evaluate(
            async ({ transactions, accountName }) => {
              const बजट = window.Actual.getBudgetAPI();
              const accounts = await बजट.getAccounts();
              const accountId = accounts.find(a => a.name === accountName)?.id;
              if (!accountId) throw new Error('Account not found');

              const categories = await बजट.getCategories();
              const getCatId = (name: string) =>
                categories.find(c => c.name === name)?.id;

              for (const txn of transactions) {
                await बजट.addTransaction(accountId, {
                  category_id: getCatId(txn.categoryName),
                  amount: txn.amount,
                  date: monthUtils.currentDay(),
                });
              }
            },
            {
              accountName: ACCOUNT_NAME,
              transactions: [
                { categoryName: VISIBLE_EXPENSE_CAT, amount: -5000 }, // Overspent by 50
                { categoryName: HIDDEN_EXPENSE_CAT, amount: -6000 }, // Overspent by 60, but hidden
                { categoryName: VISIBLE_INCOME_CAT, amount: 7000 }, // "Overspent" income by 70 (negative balance)
                { categoryName: NOT_OVERSPENT_CAT, amount: 2000 }, // Spent 20
              ],
            },
          );

          // Budget the "Not Overspent" category so it has a positive balance
          const budgetPage = await navigation.goToBudgetPage();
          const budgetMenuModal = await budgetPage.openBudgetMenu(
            NOT_OVERSPENT_CAT,
          );
          await budgetMenuModal.setBudgetAmount('10000'); // Budget 100, spent 20, balance 80
          await budgetMenuModal.close();
        }

        test('Overspending banner behavior in Tracking mode', async () => {
          await setupCategoriesAndTransactions();
          const budgetPage = await navigation.goToBudgetPage();

          // 1. Verify the "Overspent categories" banner is visible and button says "Info"
          const overspentBanner = budgetPage.page.getByText(
            /You have .* overspent categories/,
          );
          await expect(overspentBanner).toBeVisible();
          const infoButton = budgetPage.page.getByRole('button', {
            name: 'Info',
          });
          await expect(infoButton).toBeVisible();

          // 2. Click "Info" and verify the modal opens
          await infoButton.click();
          const categoryAutocompleteModal = budgetPage.page.getByRole('dialog');
          await expect(categoryAutocompleteModal).toBeVisible();
          await expect(
            categoryAutocompleteModal.getByRole('heading', {
              name: 'Cover overspending',
            }),
          ).toBeVisible();

          // 3. In the modal, verify contents
          const getCategoryItem = (name: string) =>
            categoryAutocompleteModal.getByText(name, { exact: true });

          await expect(getCategoryItem(VISIBLE_EXPENSE_CAT)).toBeVisible();
          await expect(getCategoryItem(HIDDEN_EXPENSE_CAT)).not.toBeVisible();
          await expect(getCategoryItem(VISIBLE_INCOME_CAT)).not.toBeVisible();
          await expect(getCategoryItem(NOT_OVERSPENT_CAT)).not.toBeVisible();

          // 4. Click on "Visible Expense" and verify no new modal opens
          await getCategoryItem(VISIBLE_EXPENSE_CAT).click();
          
          // Check that the current modal (CategoryAutocompleteModal) is still open
          // and a "Cover from" modal (which indicates the next step for envelope) did not appear.
          await expect(
            categoryAutocompleteModal.getByRole('heading', {
              name: 'Cover overspending',
            }),
          ).toBeVisible();
          await expect(
            budgetPage.page.getByRole('dialog').getByRole('heading', { name: VISIBLE_EXPENSE_CAT })
          ).not.toBeVisible(); // This would be the title of the 'cover' modal if it opened

          await expect(page).toMatchThemeScreenshots();
        });
      });
    }
  });
});
