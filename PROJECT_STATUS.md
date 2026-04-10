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

## 4. Current Progress
*   [x] Core architecture setup
*   [x] API & CLI implementation
*   [x] Initial parsing logic migration
*   [ ] Refinement of parsing logic for edge cases (In Progress)
*   [ ] Enhanced visualization for deep JSON structures
