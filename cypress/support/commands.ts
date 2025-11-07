/// <reference types="cypress" />

// Custom Cypress commands for HealthLevers E2E testing

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to log in to the application
       * @example cy.login('user@example.com', 'password')
       */
      login(email: string, password: string): Chainable<void>;

      /**
       * Custom command to select a metric by name
       * @example cy.selectMetric('Timeliness – SCH')
       */
      selectMetric(metricName: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('not.include', '/login');
});

Cypress.Commands.add('selectMetric', (metricName: string) => {
  cy.contains(metricName).click();
  cy.contains('Selected Metric').should('be.visible');
});

export {};
