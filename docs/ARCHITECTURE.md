# System Architecture

## 1. Directory Structure
- `main.py`: Entry point for FastAPI server.
- `cli.py`: Entry point for Command Line Interface.
- `app/core/parsers/`: Core parsing engines (Policy, Condition, Lists).
- `app/services/`: Orchestration layer combining multiple parsers.
- `app/api/`: FastAPI routers and endpoints.
- `app/models/`: Pydantic schemas for data validation.

## 2. Data Flow
1. **Input**: XML file from Skyhigh SWG (Manual upload or API fetch).
2. **Parsing**: 
   - `PolicyParser`: Walks the rule tree.
   - `ConditionParser`: Flattens complex logic into readable text.
   - `ListsParser`: Extracts global object definitions.
3. **Integration**: `ParserService` combines rules and list references.
4. **Output**: Unified JSON or Excel (Staircase/Flat format) for UI or Diff analysis.

## 3. Key Design Principles
- **Sequential Integrity**: Maintain top-to-bottom order of the original policy for correct execution flow analysis.
- **Traceability**: Every rule and group has a unique path to enable future "Diff" comparison between different policy versions.
- **Decoupling**: Core logic is independent of the delivery method (Web API or CLI).
