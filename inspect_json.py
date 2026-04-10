import json
import sys
from rich.console import Console
from rich.tree import Tree
from pathlib import Path
import argparse
from io import StringIO

console = Console()

def extract_paths_info(data, current_path_list=None, all_paths=None, clean_paths=None, current_depth=0):
    """JSON에서 중복 제거 경로, 순수 구조 경로, 최대 깊이 추출"""
    if all_paths is None:
        all_paths = set()
    if clean_paths is None:
        clean_paths = set()
    if current_path_list is None:
        current_path_list = []
    
    max_d = current_depth

    if isinstance(data, dict):
        for key, value in data.items():
            # 중첩(Recursion) 감지
            is_recursive = key in current_path_list
            new_path_list = current_path_list + [key]
            new_path_str = ".".join(new_path_list)
            
            # 전체 경로 저장
            path_entry = new_path_str + (" [RECURSIVE]" if is_recursive else "")
            all_paths.add(path_entry)
            
            # 중첩되지 않은 순수 경로만 따로 저장
            if not any(k in current_path_list for k in [key]):
                # 현재 키가 상위 어디에도 없어야 Clean Path
                clean_paths.add(new_path_str)
            
            # 재귀 탐색
            _, d = extract_paths_info(value, new_path_list, all_paths, clean_paths, current_depth + 1)
            max_d = max(max_d, d)
            
    elif isinstance(data, list):
        for item in data:
            _, d = extract_paths_info(item, current_path_list, all_paths, clean_paths, current_depth)
            max_d = max(max_d, d)
    
    return all_paths, max_d

def get_tree_text(paths, tree_title):
    """Rich Tree를 텍스트 문자열로 변환 (파일 저장용)"""
    # [RECURSIVE] 표시 제거 및 정렬
    clean_sorted = sorted([p.replace(" [RECURSIVE]", "") for p in paths])
    recursive_paths = {p.replace(" [RECURSIVE]", "") for p in paths if "[RECURSIVE]" in p}
    
    # 임시 콘솔을 사용하여 텍스트 추출
    file_console = Console(file=StringIO(), force_terminal=False, color_system=None)
    tree = Tree(tree_title)
    nodes = {"": tree}

    for path in clean_sorted:
        parts = path.split('.')
        for i in range(len(parts)):
            parent_path = ".".join(parts[:i])
            current_full_path = ".".join(parts[:i+1])
            
            if current_full_path not in nodes:
                parent_node = nodes[parent_path]
                label = parts[i]
                if current_full_path in recursive_paths:
                    label += " (Recursive Pattern)"
                nodes[current_full_path] = parent_node.add(label)
    
    file_console.print(tree)
    return file_console.file.getvalue()

def save_report(output_path, filename, all_paths, clean_paths, max_depth):
    """상세 리포트 저장"""
    tree_text = get_tree_text(all_paths, f"Schema Tree: {filename}")
    recursive_count = sum(1 for p in all_paths if "[RECURSIVE]" in p)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"JSON SCHEMA ANALYSIS REPORT: {filename}\n")
        f.write("="*70 + "\n")
        f.write(f"Summary:\n")
        f.write(f"  - Total Unique Paths (incl. recursion): {len(all_paths)}\n")
        f.write(f"  - Core Schema Paths (recursion-free): {len(clean_paths)}\n")
        f.write(f"  - Maximum Depth Found: {max_depth}\n")
        f.write(f"  - Recursive Patterns Detected: {recursive_count}\n")
        f.write("="*70 + "\n\n")
        
        f.write("1. VISUAL TREE STRUCTURE\n")
        f.write("-" * 30 + "\n")
        f.write(tree_text)
        f.write("\n")
        
        f.write("2. CORE SCHEMA PATHS (Recursion Removed)\n")
        f.write("-" * 30 + "\n")
        for p in sorted(list(clean_paths)):
            f.write(f"{p}\n")
        f.write("\n")
        
        f.write("3. ALL UNIQUE PATHS (with Recursion markers)\n")
        f.write("-" * 30 + "\n")
        for p in sorted(list(all_paths)):
            f.write(f"{p}\n")

def main():
    parser = argparse.ArgumentParser(description="Advanced JSON Schema Inspector")
    parser.add_argument("file", help="Path to the JSON file to inspect")
    parser.add_argument("-o", "--output", help="Path to save the analysis report (.txt)")
    args = parser.parse_args()

    path = Path(args.file)
    if not path.exists():
        console.print(f"[bold red]파일을 찾을 수 없습니다:[/bold red] {args.file}")
        return

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        console.print(f"[bold red]JSON 로드 실패:[/bold red] {str(e)}")
        return

    console.rule(f"[bold blue]Advanced Schema Inspector: {path.name}[/bold blue]")
    
    # 1. 데이터 분석
    with console.status("[bold green]구조 분석 및 중첩 감지 중..."):
        all_paths, max_depth = extract_paths_info(data, clean_paths=(clean_paths := set()))
    
    # 2. 터미널 출력 (트리)
    from rich.tree import Tree as RichTree
    recursive_paths = {p.replace(" [RECURSIVE]", "") for p in all_paths if "[RECURSIVE]" in p}
    term_tree = RichTree(f"[bold yellow]Schema Tree (Max Depth: {max_depth})[/bold yellow]")
    nodes = {"": term_tree}
    
    for path_str in sorted([p.replace(" [RECURSIVE]", "") for p in all_paths]):
        parts = path_str.split('.')
        for i in range(len(parts)):
            parent_path = ".".join(parts[:i])
            curr_path = ".".join(parts[:i+1])
            if curr_path not in nodes:
                label = f"[bold magenta]{parts[i]}[/bold magenta]"
                if curr_path in recursive_paths:
                    label += " [bold red](Recursive Pattern)[/bold red]"
                nodes[curr_path] = nodes[parent_path].add(label)
    
    console.print(term_tree)

    # 3. 요약 출력
    console.rule("[bold blue]Summary[/bold blue]")
    console.print(f"Core Paths (No Recursion): [bold green]{len(clean_paths)}[/bold green]")
    console.print(f"Max Depth: [bold cyan]{max_depth}[/bold cyan]")
    console.print(f"Recursive Detected: [bold red]{sum(1 for p in all_paths if '[RECURSIVE]' in p)}[/bold red]")

    # 4. 리포트 저장
    if args.output:
        try:
            save_report(args.output, path.name, all_paths, clean_paths, max_depth)
            console.print(f"\n[bold green]상세 리포트 저장 완료:[/bold green] [cyan]{args.output}[/cyan]")
        except Exception as e:
            console.print(f"[bold red]리포트 저장 실패:[/bold red] {str(e)}")

if __name__ == "__main__":
    main()
