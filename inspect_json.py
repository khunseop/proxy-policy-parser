import json
import sys
from pathlib import Path
import argparse

def get_unique_schema_hierarchy(data, current_path_list=None, seen_structures=None, depth=0):
    """
    중첩을 제거한 순수 스키마 계층 구조를 추출 (수동 복사 최적화)
    결과: [(depth, key_name), ...]
    """
    if current_path_list is None:
        current_path_list = []
    if seen_structures is None:
        seen_structures = set()

    hierarchy = []

    if isinstance(data, dict):
        for key, value in data.items():
            # 현재 경로에서 이 키가 나타났는지 확인 (단순 중첩 감지)
            # path_str은 상위 계층 구조를 포함하여 중복 여부 판단
            path_str = ".".join(current_path_list + [key])
            
            # 이미 분석한 고유 경로면 스킵 (순수 스키마만 추출)
            if path_str in seen_structures:
                continue
            
            seen_structures.add(path_str)
            hierarchy.append((depth, key))
            
            # 재귀적으로 하위 구조 탐색 (중첩 패턴이면 더 이상 들어가지 않음)
            if key not in current_path_list:
                child_hierarchy = get_unique_schema_hierarchy(
                    value, current_path_list + [key], seen_structures, depth + 1
                )
                hierarchy.extend(child_hierarchy)
                
    elif isinstance(data, list) and len(data) > 0:
        # 리스트는 첫 번째 요소만 샘플로 분석 (스키마 파악용)
        hierarchy.extend(get_unique_schema_hierarchy(data[0], current_path_list, seen_structures, depth))
    
    return hierarchy

def save_manual_friendly_report(output_path, filename, hierarchy):
    """탭 없이 숫자로 계층을 표시하는 리포트 저장"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"# JSON SCHEMA MANUAL-COPY REPORT: {filename}\n")
        f.write(f"# Format: [Depth]: [KeyName]\n")
        f.write("="*50 + "\n")
        
        for depth, key in hierarchy:
            # 탭이나 들여쓰기 없이 숫자와 콜론으로만 구분
            f.write(f"{depth}: {key}\n")
        
        f.write("="*50 + "\n")
        f.write(f"# Total Unique Keys: {len(hierarchy)}\n")

def main():
    parser = argparse.ArgumentParser(description="Manual-Copy Friendly JSON Inspector")
    parser.add_argument("file", help="Path to the JSON file to inspect")
    parser.add_argument("-o", "--output", help="Path to save the numbered report (.txt)")
    args = parser.parse_args()

    path = Path(args.file)
    if not path.exists():
        print(f"Error: File not found: {args.file}")
        return

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error: Failed to load JSON: {str(e)}")
        return

    # 1. 고유 계층 구조 분석
    print(f"Analyzing structure of {path.name}...")
    hierarchy = get_unique_schema_hierarchy(data)
    
    # 2. 터미널 출력 (미리보기)
    print("\n--- Manual-Copy Friendly Preview ---")
    print("Format: [Depth]: [KeyName]")
    print("-" * 35)
    for depth, key in hierarchy[:20]:  # 상위 20개만 출력
        print(f"{depth}: {key}")
    if len(hierarchy) > 20:
        print(f"... and {len(hierarchy) - 20} more keys.")
    
    print("-" * 35)
    print(f"Total Unique Keys: {len(hierarchy)}")

    # 3. 파일 저장
    output_file = args.output if args.output else "schema_manual.txt"
    try:
        save_manual_friendly_report(output_file, path.name, hierarchy)
        print(f"\nSuccess: Numbered report saved to '{output_file}'")
        print("You can now manually copy this list easily from the screen.")
    except Exception as e:
        print(f"Error: Failed to save report: {str(e)}")

if __name__ == "__main__":
    main()
