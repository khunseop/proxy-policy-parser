import json
import sys
from pathlib import Path
import argparse

def get_full_schema_hierarchy(data, stack=None, seen_at_depth=None, depth=0):
    """
    중첩 구조를 명시하면서 탭 없이 계층을 추출
    결과: [(depth, key_name, is_recursive), ...]
    """
    if stack is None:
        stack = []
    if seen_at_depth is None:
        seen_at_depth = set()

    hierarchy = []

    if isinstance(data, dict):
        for key, value in data.items():
            # 현재 경로(stack)에 이미 이 키가 있다면 재귀 발생
            is_recursive = key in stack
            
            # (depth, key, stack_path) 조합으로 이미 기록했는지 확인하여 중복 출력 방지
            path_id = (depth, key, ".".join(stack))
            if path_id in seen_at_depth:
                continue
            
            seen_at_depth.add(path_id)
            
            if is_recursive:
                # 재귀가 발생한 지점을 표시하고, 하위 탐색은 중단 (이미 상위에서 구조가 나왔으므로)
                hierarchy.append((depth, f"{key} [RECURSIVE]", True))
            else:
                hierarchy.append((depth, key, False))
                # 재귀가 아니면 하위 구조 탐색
                child_hierarchy = get_full_schema_hierarchy(
                    value, stack + [key], seen_at_depth, depth + 1
                )
                hierarchy.extend(child_hierarchy)
                
    elif isinstance(data, list) and len(data) > 0:
        # 리스트의 경우 모든 요소를 검사하여 발생 가능한 모든 키 구조를 수집
        for item in data:
            hierarchy.extend(get_full_schema_hierarchy(item, stack, seen_at_depth, depth))
    
    return hierarchy

def save_manual_friendly_report(output_path, filename, hierarchy):
    """숫자 계층과 재귀 표시가 포함된 리포트 저장"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"# JSON FULL SCHEMA REPORT (Manual-Copy Optimized): {filename}\n")
        f.write(f"# Format: [Depth]: [KeyName]\n")
        f.write(f"# [RECURSIVE] indicates the point where a parent key repeats.\n")
        f.write("="*65 + "\n")
        
        for depth, key, _ in hierarchy:
            f.write(f"{depth}: {key}\n")
        
        f.write("="*65 + "\n")
        recursive_count = sum(1 for _, _, is_rec in hierarchy if is_rec)
        f.write(f"# Total Unique Structural Keys: {len(hierarchy)}\n")
        f.write(f"# Recursive Entry Points Detected: {recursive_count}\n")

def main():
    parser = argparse.ArgumentParser(description="Full Schema Inspector (Manual-Copy Friendly)")
    parser.add_argument("file", help="Path to the JSON file to inspect")
    parser.add_argument("-o", "--output", help="Path to save the report (.txt)")
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

    # 1. 스키마 분석 (재귀 감지 포함)
    print(f"Analyzing full structure of {path.name}...")
    hierarchy = get_full_schema_hierarchy(data)
    
    # 2. 터미널 출력 (미리보기)
    print("\n--- Manual-Copy Friendly Preview ---")
    print("-" * 45)
    for depth, key, is_rec in hierarchy[:30]:
        print(f"{depth}: {key}")
    if len(hierarchy) > 30:
        print(f"... and {len(hierarchy) - 30} more entries.")
    
    print("-" * 45)
    print(f"Total Entries: {len(hierarchy)}")
    print(f"Recursive Points: {sum(1 for _, _, is_rec in hierarchy if is_rec)}")

    # 3. 파일 저장
    output_file = args.output if args.output else "full_schema_manual.txt"
    try:
        save_manual_friendly_report(output_file, path.name, hierarchy)
        print(f"\nSuccess: Full schema report saved to '{output_file}'")
    except Exception as e:
        print(f"Error: Failed to save report: {str(e)}")

if __name__ == "__main__":
    main()
