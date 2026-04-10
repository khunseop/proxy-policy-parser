import json
import sys
from rich.console import Console
from rich.tree import Tree
from rich.table import Table
from pathlib import Path

console = Console()

def extract_unique_paths(data, current_path="", paths=None):
    """JSON에서 중복을 제거한 모든 키 경로를 추출"""
    if paths is None:
        paths = set()

    if isinstance(data, dict):
        for key, value in data.items():
            new_path = f"{current_path}.{key}" if current_path else key
            paths.add(new_path)
            extract_unique_paths(value, new_path, paths)
    elif isinstance(data, list):
        # 리스트의 경우 내부 요소들의 구조가 다양할 수 있으므로 
        # 모든 요소를 탐색하되 중복된 경로는 set으로 자동 제거됨
        for item in data:
            extract_unique_paths(item, current_path, paths)
    
    return paths

def build_unique_tree(paths):
    """추출된 고유 경로들을 다시 Tree 구조로 변환"""
    sorted_paths = sorted(list(paths))
    root_tree = Tree("[bold yellow]Unique Schema Structure[/bold yellow]")
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

def inspect_json(file_path: str):
    path = Path(file_path)
    if not path.exists():
        console.print(f"[bold red]파일을 찾을 수 없습니다:[/bold red] {file_path}")
        return

    try:
        # 파일 전체를 읽지 않고 스트리밍 방식으로 처리하면 더 좋으나, 
        # 일단 로드 속도보다는 분석 속도 최적화에 집중
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        console.print(f"[bold red]JSON 로드 실패:[/bold red] {str(e)}")
        return

    console.rule(f"[bold blue]Fast Schema Inspector: {path.name}[/bold blue]")
    
    # 1. 고유 경로 추출 (값 제외)
    with console.status("[bold green]Unique 키 경로 추출 중..."):
        unique_paths = extract_unique_paths(data)
    
    # 2. 트리 시각화 (중복 제거된 구조)
    console.print(build_unique_tree(unique_paths))

    # 3. 경로 리스트 요약
    console.rule("[bold blue]Summary[/bold blue]")
    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Property Path (Keys Only)", style="dim")
    
    # 너무 많을 수 있으므로 정렬된 상위 50개 정도만 예시로 보여주거나 전체 출력 선택
    sorted_paths = sorted(list(unique_paths))
    for p in sorted_paths[:100]: # 일단 100개까지만 테이블 출력
        table.add_row(p)
    
    console.print(table)
    if len(sorted_paths) > 100:
        console.print(f"... and {len(sorted_paths) - 100} more paths.")
        
    console.print(f"\n[bold yellow]Total unique attribute paths found:[/bold yellow] {len(unique_paths)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        console.print("[bold red]사용법:[/bold red] python inspect_json.py <file_path.json>")
    else:
        inspect_json(sys.argv[1])
