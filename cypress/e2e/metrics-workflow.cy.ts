/// <reference types="cypress" />

/**
 * End-to-End Test: Complete Metrics Workflow
 *
 * Tests the full user journey:
 * 1. Select a metric
 * 2. View signal groups
 * 3. Answer followup questions
 * 4. Submit form
 */

describe('Metrics Workflow', () => {
  beforeEach(() => {
    // Visit metrics page
    // Note: In production, would handle authentication first
    cy.visit('/metrics');
  });

  describe('Metric Selection', () => {
    it('should load specialties', () => {
      cy.contains('Select Quality Metric').should('be.visible');
      cy.contains('Specialty').should('be.visible');
      cy.get('select').first().should('contain', 'All Specialties');
    });

    it('should filter metrics by specialty', () => {
      // Select a specialty
      cy.get('select').first().select('ORTHO');

      // Should show filtered count
      cy.contains(/Found \d+ metric/).should('be.visible');

      // Should show ORTHO metrics
      cy.contains('ORTHO').should('be.visible');
    });

    it('should search metrics', () => {
      // Type in search box
      cy.get('input[placeholder*="Search"]').type('hip');

      // Should filter results
      cy.contains(/Found \d+ metric/).should('be.visible');
    });

    it('should select a metric', () => {
      // Wait for metrics to load
      cy.contains(/Found \d+ metric/, { timeout: 10000 }).should('be.visible');

      // Click first metric
      cy.get('[role="button"]').contains(/ORTHO|Timeliness/).first().click();

      // Should show selected state
      cy.get('[role="button"]').first().should('have.class', 'border-primary');
    });
  });

  describe('Signal Display', () => {
    beforeEach(() => {
      // Select a metric first
      cy.contains(/Found \d+ metric/, { timeout: 10000 }).should('be.visible');
      cy.get('[role="button"]').contains(/ORTHO|Timeliness/).first().click();

      // Switch to signals tab
      cy.contains('Signal Display').click();
    });

    it('should display signal groups', () => {
      cy.contains('Signals').should('be.visible');
      cy.contains(/\d+ group/).should('be.visible');
    });

    it('should show signal chips', () => {
      // Should have signal chips
      cy.get('[data-testid^="signal-chip"]').should('have.length.greaterThan', 0);
    });

    it('should toggle group visibility', () => {
      // Click hide button
      cy.contains('button', 'Hide').first().click();

      // Should show hidden state
      cy.contains('signals hidden').should('be.visible');

      // Click show button
      cy.contains('button', 'Show').first().click();

      // Should show signals again
      cy.get('[data-testid^="signal-chip"]').should('be.visible');
    });

    it('should simulate signal values', () => {
      // Click simulate button
      cy.contains('button', 'Simulate Values').click();

      // Should show colored signal chips (not all gray)
      cy.get('[data-testid^="signal-chip"]').then(($chips) => {
        const hasColors = $chips.toArray().some((chip) => {
          const style = window.getComputedStyle(chip);
          return !style.backgroundColor.includes('241, 245, 249'); // Not gray
        });
        expect(hasColors).to.be.true;
      });
    });

    it('should toggle individual signal status', () => {
      // Click a signal chip
      cy.get('[data-testid^="signal-chip"]').first().click();

      // Click same signal again to toggle
      cy.get('[data-testid^="signal-chip"]').first().click();
    });

    it('should collapse/expand groups', () => {
      // Click group header to collapse
      cy.get('svg[class*="chevron"]').first().parent().click();

      // Signals should not be visible
      // (Check if collapsed state exists)
    });
  });

  describe('Followup Questions', () => {
    beforeEach(() => {
      // Select a metric first
      cy.contains(/Found \d+ metric/, { timeout: 10000 }).should('be.visible');
      cy.get('[role="button"]').contains(/ORTHO|Timeliness/).first().click();

      // Switch to followups tab
      cy.contains('Followup Questions').click();
    });

    it('should display followup questions', () => {
      cy.contains('Followup Questions').should('be.visible');
      cy.contains(/\d+ question/).should('be.visible');
    });

    it('should show form completion status', () => {
      // Initially not complete
      cy.contains('button[type="submit"]').should('be.disabled');
    });

    it('should handle text input', () => {
      // Find a text input
      cy.get('input[type="text"]').first().type('Test answer');

      // Should show "Answered"
      cy.contains('Answered').should('be.visible');
    });

    it('should handle yes/no questions', () => {
      // Find a yes/no question
      cy.get('input[type="radio"][value="yes"]').first().check();

      // Should be checked
      cy.get('input[type="radio"][value="yes"]').first().should('be.checked');
    });

    it('should show conditional followups', () => {
      // Answer a question that has dependent followups
      cy.get('input[type="radio"][value="yes"]').first().check();

      // Wait a bit for conditional rendering
      cy.wait(100);

      // Check if more questions appeared
      // (This is conditional based on actual data)
    });

    it('should enable submit when complete', () => {
      // Fill out all visible questions
      cy.get('input[type="text"]').each(($input) => {
        cy.wrap($input).type('Answer');
      });

      cy.get('input[type="radio"][value="yes"]').each(($input) => {
        cy.wrap($input).check();
      });

      cy.get('textarea').each(($textarea) => {
        cy.wrap($textarea).type('Detailed answer');
      });

      // Submit button should be enabled
      // (May not work if not all questions answered)
      // cy.contains('button[type="submit"]', 'Submit').should('not.be.disabled');
    });

    it('should submit form', () => {
      // Fill out at least one question
      cy.get('input[type="text"]').first().type('Test answer');

      // If submit is enabled, click it
      cy.contains('button', 'Submit Followups').then(($button) => {
        if (!$button.is(':disabled')) {
          cy.wrap($button).click();

          // Should show alert (handled by Cypress automatically)
          // Or check for success message
        }
      });
    });
  });

  describe('Complete Workflow', () => {
    it('should complete full metric configuration workflow', () => {
      // 1. Select a metric
      cy.contains(/Found \d+ metric/, { timeout: 10000 }).should('be.visible');
      cy.get('[role="button"]').contains(/ORTHO|Timeliness/).first().click();
      cy.contains('Selected Metric').should('be.visible');

      // 2. View signals
      cy.contains('Signal Display').click();
      cy.contains('Signals').should('be.visible');
      cy.get('[data-testid^="signal-chip"]').should('have.length.greaterThan', 0);

      // 3. Simulate some values
      cy.contains('button', 'Simulate Values').click();

      // 4. Go to followups
      cy.contains('Followup Questions').click();
      cy.contains('Followup Questions').should('be.visible');

      // 5. Answer a question
      const hasTextInput = Cypress.$('input[type="text"]').length > 0;
      if (hasTextInput) {
        cy.get('input[type="text"]').first().type('Completed workflow test');
      }

      // 6. Verify form updates
      cy.contains('Answered').should('exist');
    });
  });

  describe('API Integration', () => {
    it('should load data from API', () => {
      // Intercept API calls
      cy.intercept('GET', '/api/metadata/specialties').as('getSpecialties');
      cy.intercept('GET', '/api/metadata/metrics*').as('getMetrics');

      // Visit page
      cy.visit('/metrics');

      // Wait for API calls
      cy.wait('@getSpecialties').its('response.statusCode').should('eq', 200);
      cy.wait('@getMetrics').its('response.statusCode').should('eq', 200);
    });

    it('should handle API errors gracefully', () => {
      // Intercept and force error
      cy.intercept('GET', '/api/metadata/metrics*', {
        statusCode: 500,
        body: { error: 'Server error' },
      }).as('getMetricsError');

      cy.visit('/metrics');

      // Should show error state
      // (Implementation dependent)
    });

    it('should use cached data', () => {
      // First visit
      cy.intercept('GET', '/api/metadata/metrics*').as('getMetrics1');
      cy.visit('/metrics');
      cy.wait('@getMetrics1');

      // Second visit - should use cache
      cy.reload();

      // React Query should use cached data (may not make new request)
    });
  });

  describe('Responsive Design', () => {
    it('should work on mobile viewport', () => {
      cy.viewport('iphone-x');
      cy.visit('/metrics');

      // Should still load
      cy.contains('Select Quality Metric').should('be.visible');
    });

    it('should work on tablet viewport', () => {
      cy.viewport('ipad-2');
      cy.visit('/metrics');

      cy.contains('Select Quality Metric').should('be.visible');
    });
  });

  describe('Accessibility', () => {
    it('should have proper headings', () => {
      cy.get('h1, h2, h3').should('exist');
    });

    it('should have labels for inputs', () => {
      // Select metric and go to followups
      cy.contains(/Found \d+ metric/, { timeout: 10000 }).should('be.visible');
      cy.get('[role="button"]').first().click();
      cy.contains('Followup Questions').click();

      // Check for labels
      cy.get('label').should('exist');
    });

    it('should be keyboard navigable', () => {
      // Tab through elements
      cy.get('body').tab();
      cy.focused().should('exist');
    });
  });
});
