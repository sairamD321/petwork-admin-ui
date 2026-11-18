React & TypeScript Frontend Guidelines

Core Philosophy

• Pragmatic SOLID over Strict OOP: Apply the spirit of SOLID principles using functional composition, custom hooks, and TypeScript interfaces. Do not introduce classes, inheritance, or unnecessary abstraction layers..
• Composition First: Prefer children, compound components, and slots over massive configuration props or deep boolean prop trees..
• Colocation: Keep components, custom hooks, types, and tests close to where they are used until reuse is genuinely needed across multiple features..

Architecture & SOLID Guidelines

1. Single Responsibility Principle (SRP)

• UI vs. Logic Separation: Keep JSX components focused on rendering and user interaction. Extract data fetching, complex state transitions, and side effects into custom hooks (useFeatureName)..
• Component Size: If a component exceeds ~150 lines or handles multiple unrelated concerns, split it into smaller sub-components or extract a custom hook..

2. Open/Closed Principle (OCP)

• Extensible Components: Design base UI components so they can be extended without modifying their source code..
• Avoid Flag Explosion: Instead of adding props like isHeader, hasIcon, or isCompact to handle every edge case, accept children, render functions, or composable sub-components..

3. Liskov Substitution Principle (LSP)

• Predictable Wrappers: Custom wrapper components around native HTML elements (e.g., <Button>, <Input>) must accept and forward standard HTML attributes (ComponentPropsWithoutRef<'button'>) and refs without breaking expected native behavior..

4. Interface Segregation Principle (ISP)

• Minimal Prop Interfaces: Pass only the specific primitive values or narrow data shapes a component needs..
• No Giant Objects: Avoid passing full domain models (e.g., user: User) to leaf UI components that only need name: string and avatarUrl: string..

5. Dependency Inversion Principle (DIP)

• Decouple External Services: Never import concrete API clients, analytics SDKs, or localStorage directly inside reusable UI components..
• Inject Dependencies: Pass callbacks, service interfaces, or use React Context / custom hooks so data sources can be easily swapped or mocked in unit tests..

TypeScript Standards

• Strict Mode: Assume strict: true is enabled. Never use any; use unknown with type narrowing when types are uncertain..
• Explicit Props: Define a dedicated interface or type (e.g., ButtonProps) for every component’s props..
• Avoid Over-Engineering: Do not create generic abstractions (<TData, TConfig>) unless the component is a truly reusable utility (e.g., a data table or select dropdown)..

File & Naming Conventions

• Components: PascalCase.tsx (e.g., UserProfileCard.tsx).
• Custom Hooks: camelCase.ts prefixed with use (e.g., useUserProfile.ts).
• Types/Interfaces: PascalCase (avoid I prefixes like IUserProps; use UserProps).
• Utilities: camelCase.ts for pure helper functions (e.g., formatCurrency.ts).

AI Agent Workflow Rules

1. Plan Before Refactoring: Before splitting a component or introducing a new hook, verify that it reduces complexity rather than scattering simple logic across too many files..
2. Preserve Existing Patterns: Match the project’s existing styling solution (Tailwind, CSS Modules, etc.), state management, and data-fetching library (React Query, SWR, etc.)..
3. Write Testable Code: Ensure business logic extracted into custom hooks or pure utilities can be tested independently of complex DOM trees..