# Skyhigh Proxy Policy Parser - Project Status

## 1. Architecture Overview
The project has been refactored into a modular, layered architecture for scalability and maintainability.

```text
proxy-policy-parser/
├── main.py                 # FastAPI Server (uvicorn)
├── cli.py                  # CLI Tool (Typer + Rich)
├── app/
│   ├── api/                # REST API Endpoints
│   ├── core/               
│   │   ├── parsers/        # Parsing Engines (Policy, Condition, Lists)
│   │   ├── skyhigh_client.py # API Client for Skyhigh SWG
│   │   └── config.py       # Settings & Environment Variables
│   ├── models/             # Pydantic Schemas
│   ├── services/           # Business Logic Orchestration
│   └── utils/              # Helper Utilities
├── tests/                  # Pytest Suite & Fixtures
└── requirements.txt        # Dependency Management
```

## 2. Key Components
*   **FastAPI Backend**: Supports XML file uploads and direct Skyhigh API fetches.
*   **CLI Interface**: 
    *   `list-rulesets`: View available rulesets on the gateway.
    *   `parse-local`: Parse a local XML and export to JSON/Excel.
    *   `fetch-and-parse`: Pull directly from the gateway and parse.
*   **Parsing Logic**: Specialized parsers for Rules, RuleGroups, and complex Conditions (Property, Operator, Value).

## 3. How to Run
### API Server
```bash
python main.py
```
Access Swagger UI at `http://localhost:8000/docs`.

### CLI Tool
```bash
python cli.py --help
python cli.py list-rulesets
python cli.py parse-local sample.xml --excel output.xlsx
```

## 4. Detailed Schema Analysis (Air-Gap Report Result)
The following key structures were identified from the exhaustive schema inspection:

### Root Level (Depth 0-1)
*   `libraryContent`: Global Root
    *   `configurations`: Gateway metadata and properties.
    *   `libraryObject`: Library version and naming.
    *   `lists`: Global objects (IP, URL, User lists).
    *   `ruleGroup`: The main policy tree.

### Policy Tree & Rules
*   **Recursive RuleGroups**: `ruleGroup` can nest infinitely via `ruleGroups`.
*   **Rules**: Found under `ruleGroup/rules/rule`.
*   **Actions**:
    *   `actionContainer`: Primary rule actions (ID, ConfigID).
    *   `immediateActionContainers`: Side-effects like `setAction`, `executeAction` (Procedures), and `enableEngine`.

### Complex Conditions
*   **Condition Expressions**: Found under `condition/expressions/conditionExpression`.
*   **Property Instances**: Highly recursive. A property can have parameters, which can themselves be nested properties.
*   **Values**: Can be `stringValue`, `listValue` (referencing an ID), or a nested `propertyInstance`.

### Global Lists
*   Supports `complexEntry` which includes `configurationProperties` and `acElements`, indicating that lists can contain objects, not just strings.

## 5. Completed Refinement (Based on Schema Analysis)
The following parser enhancements have been implemented to handle the complex Skyhigh SWG schema:

### Stage 1: Action Precision Parsing (Completed)
*   **PolicyParser Enhancement**: Now extracts detailed actions from `immediateActionContainers`.
*   Identifies `SetProperty`, `ExecuteProcedure`, and `EnableEngine` actions into human-readable summaries.

### Stage 2: Deep Recursion & Stringifier (Completed)
*   **ConditionParser Refactor**: Implemented recursive property/value stringification.
*   Converts Depth 35+ AST structures into readable strings (e.g., `URL.Host(A=B) equals List(ID:123)`).
*   Prevents context bloat in Excel/JSON by flattening complex logic into a single `condition_text` column.

### Stage 3: Complex List Parsing (Completed)
*   **ListsParser Refactor**: Added support for `complexEntry` in global lists.
*   Extracts `configurationProperties` from list entries, supporting metadata attached to list items.

## 6. Next Steps
*   [ ] **Validation**: Test the refactored parsers with the internal private sample to ensure correctness across all 685 paths.
*   [ ] **Excel Formatting**: Further improve the multi-sheet Excel output to group related ruleGroups more logically.
*   [ ] **Web UI Integration**: Start planning the FastAPI-to-React/Angular interface.
