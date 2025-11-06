# Overview

This USNWR Abstraction Helper application streamlines medical record abstraction for healthcare quality review, specifically in orthopedics (pediatric). It dynamically selects questions, simulates LLM inference, and validates signals for clinical quality measures. The system enables medical abstractors to analyze patient data against specialty-specific quality questions using customizable LLM prompts and validation layers.

The application features a progressive disclosure design, maximizing vertical space by revealing content dynamically based on user actions: question selection, patient data loading, and finally, a split-screen layout with signal assessment and LLM chat. It incorporates Lurie Children's Hospital branding and color scheme. The project aims to enhance medical abstraction capabilities with robust security features, supporting a seamless clinical workflow.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Full-Stack Structure
The application uses a monorepo architecture:
- **client/**: React frontend with TypeScript
- **server/**: Express.js backend with TypeScript
- **shared/**: Common schemas and types

## Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: TailwindCSS with shadcn/ui
- **State Management**: React Query
- **Routing**: Wouter
- **Build Tool**: Vite

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Data Layer**: In-memory storage with JSON file persistence
- **API Design**: RESTful endpoints
- **Development Setup**: Custom Vite integration

## Database & Schema Design
- **ORM**: Drizzle ORM for PostgreSQL
- **Schema Location**: `shared/schema.ts` using Zod validation
- **Data Models**: SpecialtyConfig, PatientData, AbstractionResult, ValidationResult

## Component Architecture
The frontend follows a progressive disclosure pattern:
- **Dynamic Layout**: Progressive disclosure starting with question selection.
- **Conditional Rendering**: Patient data revealed on question selection; analysis revealed on patient selection.
- **Split-Screen Design**: Left for signal assessment and prompts, right for LLM chat.
- **Header-Based Navigation**: Medical specialty selector in header.
- **LLM Integration**: Real-time chat with OpenAI GPT-4o.
- **Signal Validation Display**: Color-coded chips (pass, fail, caution, inactive).
- **Accessibility Features**: ARIA attributes for content and focus management.
- **UI/UX Decisions**: Application of Lurie Children's Hospital branding and official color palette. Implementation of uniform chip styling, focus states, hover effects, gradient backgrounds, and grid-based layouts for consistent professional appearance.

## Validation Layer
The application implements a multi-stage validation system:
- **LLM Inference**: Initial AI analysis.
- **Signal Validation**: Domain-specific rule checking.
- **CDC/NHSN Compliance**: Healthcare standard validation rules.
- **Evidence Compilation**: Supporting documentation.

## Core Features
- **Replit Auth Integration**: Comprehensive authentication system with PostgreSQL for secure user management.
- **Deterministic Prompt Routing**: Crisp routing system with `${specialty}:${module}:${type}` keys, fallback chains, evidence scoping, and validation guardrails.
- **PromptStore with Typed Prompts**: Enhanced system with Type (Abstraction Help/Signal Processing) and Module scoping, supporting both legacy and new prompt resolution patterns.
- **AI Signal Intake Flow**: Complete integration processing raw patient JSON through OpenAI GPT-4o with typed Signal Processing prompts, generating structured signal results.
- **Specialty Metadata System**: Dynamic specialty selection with 20+ medical modules across various specialties.
- **Planning Configuration System**: LocalStorage-persistent configuration for group and field ordering with advanced UX controls.
- **Test Case Consolidation**: Unified `testCases.json` with 14 comprehensive test cases covering medical modules.
- **Signal Inference Engine**: Deterministic logic for all 8 medical modules with precise time calculations.
- **Evidence Scoping System**: Signal-specific evidence filtering using `signal.cites[]` paths with "Show all case context" toggle functionality.
- **Dynamic Module Generation**: Replaced hard-coded MODULE_CASES with dynamic generation from testCases.json data for better maintainability.
- **Unified Signal Sourcing**: Implemented signalsForView logic to consolidate signal processing across the application.
- **Effective Status Calculation**: Added computeCaseStatusFallback function for robust status handling with fallback logic.
- **Global Panel Access**: PromptStore and Planning Configuration panels accessible from any page via navbar toggle buttons.

# Project Status

## Recent Changes (August 2024)
- **System Consistency Fixes**: Implemented comprehensive fixes based on DEV_NOTES analysis for improved system linkage
- **Enhanced Server Validation**: Added structured signal validation with evidence and cites arrays in validateSCHTimeliness
- **Consistent Storage Keys**: Unified localStorage usage with `abstraction.cases` key across intake and home modules  
- **Evidence System Foundation**: Created EvidenceDrawer component for displaying signal evidence and data source citations
- **Ready for Review Gate**: Added explicit readyForReview boolean flag requiring manual marking in intake workflow
- **Timeliness Calculation Priority**: Updated SCHInlinePanel to trust server-computed signals over client-side calculations
- **Signal Processing Cache**: Implemented intelligent caching to prevent unnecessary reprocessing of the same case data
- **AI Signal Intake Integration**: Fixed data flow between AI Signal Intake and Abstraction Helper modules with auto-selection
- **PromptStore Enhanced**: Added typed prompts (Abstraction Help/Signal Processing) with proper module scoping
- **Deterministic Prompt Routing**: Implemented crisp routing design with unambiguous prompt resolution, evidence scoping, and telemetry tracking
- **Evidence Validation System**: Added evidence path validators and guardrails to prevent cross-domain speculation
- **Minimal Context Extraction**: Context filtering based on module type to reduce token usage and improve precision

## Clean Project Structure
The project now maintains a clean structure with only essential files:
- Core application code in `client/`, `server/`, `shared/`
- Essential sample data in `attached_assets/` (2 patient JSON files)
- Signal mapping data moved to `server/data/` for proper organization

# External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL database connectivity.
- **drizzle-orm & drizzle-kit**: Type-safe ORM and database migrations.
- **@tanstack/react-query**: Server state management and caching.
- **openai**: GPT-4o integration for LLM-powered medical data analysis.

### UI Component Library
- **@radix-ui/react-***: Accessible UI primitives.
- **class-variance-authority & clsx**: Utility-first styling.
- **tailwindcss**: CSS framework.
- **lucide-react**: Icon library.

### Development Tools
- **vite**: Fast build tool and development server.
- **typescript**: Type safety.
- **@replit/vite-plugin-***: Replit-specific enhancements.

### Data Processing
- **zod**: Runtime type validation and schema definition.
- **date-fns**: Date manipulation utilities.