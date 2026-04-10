import json
import sys
from rich.console import Console
from rich.tree import Tree
from rich.table import Table
from pathlib import Path
import argparse

console = Console()

def extract_unique_paths_and_depth(data, current_path="", paths=None, current_depth=0):
    """JSON에서 중복을 제거한 모든 키 경로와 최대 깊이 추출"""
    if paths is None:
        paths = set()
    
    max_d = current_depth

    if isinstance(data, dict):
        for key, value in data.items():
            new_path = f"{current_path}.{key}" if current_path else key
            paths.add(new_path)
            d = extract_unique_paths_and_depth(value, new_path, paths, current_depth + 1)
            max_d = max(max_d, d)
    elif isinstance(data, list):
        for item in data:
            d = extract_unique_paths_and_depth(item, current_path, paths, current_depth)
            max_d = max(max_d, d)
    
    return paths, max_d

def build_unique_tree(paths, tree_title="Unique Schema Structure"):
    """추출된 고유 경로들을 다시 Tree 구조로 변환"""
    sorted_paths = sorted(list(paths))
    root_tree = Tree(f"[bold yellow]{tree_title}[/bold yellow]")
    nodes = {"": root_tree}

    for path in sorted_paths:
        parts = path.split('.')
        for i in range(len(parts)):
            parent_path = ".".join(parts[:i])
            current_full_path = ".".join(parts[:i+1])
            
            if current_full_path not in nodes:
                parent_node = nodes[parent_path]
                nodes[current_full_path] = parent_node.add(f"[bold magenta]{parts[i]}[/bold magenta]")
    
    return root_tree

def save_to_file(output_path, filename, unique_paths, max_depth):
    """분석 결과를 텍스트 파일로 저장 (Value 제외)"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"JSON Schema Analysis Report: {filename}\n")
        f.write("="*50 + "\n")
        f.write(f"Total Unique Paths: {len(unique_paths)}\n")
        f.write(f"Maximum Depth: {max_depth}\n")
        f.write("="*50 + "\n\n")
        
        f.write("--- Unique Property Paths ---\n")
        for p in sorted(list(unique_paths)):
            f.write(f"{p}\n")

def main():
    parser = argparse.ArgumentParser(description="Fast JSON Schema Inspector (Keys only)")
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
    with console.status("[bold green]Unique 키 구조 및 깊이 분석 중..."):
        unique_paths, max_depth = extract_unique_paths_and_depth(data)
    
    # 2. 트리 시각화
    console.print(build_unique_tree(unique_paths, tree_title=f"Schema Tree (Max Depth: {max_depth})"))

    # 3. 요약 정보
    console.rule("[bold blue]Analysis Summary[/bold blue]")
    console.print(f"Total Unique Paths: [bold cyan]{len(unique_paths)}[/bold cyan]")
    console.print(f"Maximum Depth: [bold green]{max_depth}[/bold green]")

    # 4. 파일 저장
    if args.output:
        try:
            save_to_file(args.output, path.name, unique_paths, max_depth)
            console.print(f"\n[bold green]분석 결과가 저장되었습니다:[/bold green] [cyan]{args.output}[/cyan]")
            console.print("[dim]이 파일에는 데이터(Value)가 포함되어 있지 않아 안전하게 공유 가능합니다.[/dim]")
        except Exception as e:
            console.print(f"[bold red]파일 저장 실패:[/bold red] {str(e)}")

if __name__ == "__main__":
    main()
