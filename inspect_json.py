import json
import sys
from rich.console import Console
from rich.tree import Tree
from rich.table import Table
from pathlib import Path
import argparse

console = Console()

def extract_unique_paths_and_depth(data, current_path_list=None, paths=None, current_depth=0):
    """JSON에서 중복을 제거한 모든 키 경로와 최대 깊이 추출 (중첩 감지 포함)"""
    if paths is None:
        paths = set()
    if current_path_list is None:
        current_path_list = []
    
    max_d = current_depth
    current_path_str = ".".join(current_path_list)

    if isinstance(data, dict):
        for key, value in data.items():
            # 중첩(Recursion) 감지: 상위 경로에 동일한 키가 이미 있는지 확인
            is_recursive = key in current_path_list
            new_path_list = current_path_list + [key]
            new_path_str = ".".join(new_path_list)
            
            # 경로 저장 (중첩인 경우 표시 추가)
            path_entry = new_path_str + (" [RECURSIVE]" if is_recursive else "")
            paths.add(path_entry)
            
            # 중첩인 경우 너무 깊게 들어가지 않도록 제한하거나 표시만 하고 계속 진행
            # (여기서는 분석을 위해 계속 진행하되, 최대 깊이에는 반영)
            _, d = extract_unique_paths_and_depth(value, new_path_list, paths, current_depth + 1)
            max_d = max(max_d, d)
            
    elif isinstance(data, list):
        for item in data:
            _, d = extract_unique_paths_and_depth(item, current_path_list, paths, current_depth)
            max_d = max(max_d, d)
    
    return paths, max_d

def build_unique_tree(paths, tree_title="Unique Schema Structure"):
    """추출된 고유 경로들을 다시 Tree 구조로 변환"""
    # [RECURSIVE] 표시를 제거하고 정렬하여 트리 구축
    clean_paths = sorted([p.replace(" [RECURSIVE]", "") for p in paths])
    recursive_paths = {p.replace(" [RECURSIVE]", "") for p in paths if "[RECURSIVE]" in p}
    
    root_tree = Tree(f"[bold yellow]{tree_title}[/bold yellow]")
    nodes = {"": root_tree}

    for path in clean_paths:
        parts = path.split('.')
        for i in range(len(parts)):
            parent_path = ".".join(parts[:i])
            current_full_path = ".".join(parts[:i+1])
            
            if current_full_path not in nodes:
                parent_node = nodes[parent_path]
                label = f"[bold magenta]{parts[i]}[/bold magenta]"
                if current_full_path in recursive_paths:
                    label += " [bold red](Recursive Pattern)[/bold red]"
                
                nodes[current_full_path] = parent_node.add(label)
    
    return root_tree

def find_deepest_paths(paths, limit=5):
    """가장 깊은 경로들을 추출"""
    # [RECURSIVE] 태그 제거 후 정렬
    clean_paths = [p.replace(" [RECURSIVE]", "") for p in paths]
    sorted_by_depth = sorted(clean_paths, key=lambda x: len(x.split('.')), reverse=True)
    return sorted_by_depth[:limit]

def save_to_file(output_path, filename, unique_paths, max_depth):
    """분석 결과를 텍스트 파일로 저장"""
    recursive_count = sum(1 for p in unique_paths if "[RECURSIVE]" in p)
    deepest = find_deepest_paths(unique_paths)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"JSON Schema Analysis Report: {filename}\n")
        f.write("="*60 + "\n")
        f.write(f"Total Unique Paths: {len(unique_paths)}\n")
        f.write(f"Maximum Depth: {max_depth}\n")
        f.write(f"Recursive Patterns Detected: {recursive_count}\n")
        f.write("="*60 + "\n\n")
        
        f.write("--- Deepest Paths (Potential Issues) ---\n")
        for dp in deepest:
            f.write(f"Depth {len(dp.split('.'))}: {dp}\n")
        f.write("\n")
        
        f.write("--- Unique Property Paths (* marked as recursive) ---\n")
        for p in sorted(list(unique_paths)):
            f.write(f"{p}\n")

def main():
    parser = argparse.ArgumentParser(description="Fast JSON Schema Inspector with Recursion Detection")
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

    console.rule(f"[bold blue]Fast Schema Inspector: {path.name}[/bold blue]")
    
    # 1. 고유 경로 및 깊이 추출
    with console.status("[bold green]중첩 패턴 및 깊이 분석 중..."):
        unique_paths, max_depth = extract_unique_paths_and_depth(data)
    
    # 2. 트리 시각화
    console.print(build_unique_tree(unique_paths, tree_title=f"Schema Tree (Max Depth: {max_depth})"))

    # 3. 요약 정보
    recursive_count = sum(1 for p in unique_paths if "[RECURSIVE]" in p)
    console.rule("[bold blue]Analysis Summary[/bold blue]")
    console.print(f"Total Unique Paths: [bold cyan]{len(unique_paths)}[/bold cyan]")
    console.print(f"Maximum Depth: [bold green]{max_depth}[/bold green]")
    console.print(f"Recursive Patterns: [bold red]{recursive_count}[/bold red]")

    # 4. 가장 깊은 경로 출력
    console.print("\n[bold yellow]Deepest Path Example:[/bold yellow]")
    deepest = find_deepest_paths(unique_paths, 1)
    if deepest:
        console.print(f"[dim]{deepest[0]}[/dim] (Depth: {len(deepest[0].split('.'))})")

    # 5. 파일 저장
    if args.output:
        try:
            save_to_file(args.output, path.name, unique_paths, max_depth)
            console.print(f"\n[bold green]리포트 저장 완료:[/bold green] [cyan]{args.output}[/cyan]")
        except Exception as e:
            console.print(f"[bold red]파일 저장 실패:[/bold red] {str(e)}")

if __name__ == "__main__":
    main()
