import json
import sys
from pathlib import Path
import argparse

def extract_all_paths(data, current_path_list=None, all_paths_dict=None, current_depth=0):
    """
    JSON의 모든 고유 경로를 탐색하여 685개의 경로를 모두 수집
    all_paths_dict: { path_string: (depth, key_name, is_recursive) }
    """
    if all_paths_dict is None:
        all_paths_dict = {}
    if current_path_list is None:
        current_path_list = []

    if isinstance(data, dict):
        for key, value in data.items():
            # 중첩 감지: 현재 경로(stack)에 이 키가 이미 있는지 확인
            is_recursive = key in current_path_list
            
            # 현재까지의 전체 경로 문자열 생성
            new_path_list = current_path_list + [key]
            path_str = ".".join(new_path_list)
            
            # 경로와 메타데이터 저장 (이미 있는 경로는 무시하여 유니크 유지)
            if path_str not in all_paths_dict:
                all_paths_dict[path_str] = (current_depth, key, is_recursive)
            
            # 하위 구조 탐색 (JSON은 유한하므로 계속 탐색)
            extract_all_paths(value, new_path_list, all_paths_dict, current_depth + 1)
                
    elif isinstance(data, list):
        # 리스트 내 모든 요소를 탐색하여 누락되는 키가 없도록 함
        for item in data:
            extract_all_paths(item, current_path_list, all_paths_dict, current_depth)
    
    return all_paths_dict

def save_exhaustive_manual_report(output_path, filename, all_paths_dict):
    """685개 경로를 모두 포함하며, 숫자 계층으로 표시하는 리포트 저장"""
    # 경로 문자열 기준으로 정렬하여 계층 순서 유지
    sorted_paths = sorted(all_paths_dict.keys())
    
    max_depth = 0
    recursive_count = 0
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"# JSON EXHAUSTIVE SCHEMA REPORT: {filename}\n")
        f.write(f"# Format: [Depth]: [KeyName] [RECURSIVE (if repeated in parent)]\n")
        f.write("="*70 + "\n")
        
        for path_str in sorted_paths:
            depth, key, is_recursive = all_paths_dict[path_str]
            max_depth = max(max_depth, depth)
            
            rec_label = " [RECURSIVE]" if is_recursive else ""
            if is_recursive:
                recursive_count += 1
                
            # 탭 없이 숫자와 콜론으로만 출력
            f.write(f"{depth}: {key}{rec_label}\n")
        
        f.write("="*70 + "\n")
        f.write(f"# Total Unique Paths Found: {len(all_paths_dict)}\n")
        f.write(f"# Maximum Depth: {max_depth}\n")
        f.write(f"# Recursive Patterns: {recursive_count}\n")

def main():
    parser = argparse.ArgumentParser(description="Exhaustive JSON Schema Inspector (Manual-Copy Optimized)")
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

    # 1. 모든 고유 경로 추출
    print(f"Analyzing all paths of {path.name} (Exhaustive Search)...")
    all_paths_dict = extract_all_paths(data)
    
    # 2. 터미널 미리보기
    print("\n--- Exhaustive Numbered Preview ---")
    sorted_keys = sorted(all_paths_dict.keys())
    for p_str in sorted_keys[:20]:
        depth, key, is_rec = all_paths_dict[p_str]
        rec_label = " [RECURSIVE]" if is_rec else ""
        print(f"{depth}: {key}{rec_label}")
    
    if len(all_paths_dict) > 20:
        print(f"... and {len(all_paths_dict) - 20} more paths.")
    
    print("-" * 40)
    print(f"Total Unique Paths: {len(all_paths_dict)}")
    
    # 3. 파일 저장
    output_file = args.output if args.output else "full_exhaustive_schema.txt"
    try:
        save_exhaustive_manual_report(output_file, path.name, all_paths_dict)
        print(f"\nSuccess: Exhaustive report saved to '{output_file}'")
        print(f"Total entries: {len(all_paths_dict)} (Should match your previous 685)")
    except Exception as e:
        print(f"Error: Failed to save report: {str(e)}")

if __name__ == "__main__":
    main()
